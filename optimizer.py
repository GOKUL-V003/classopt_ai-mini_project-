"""
optimizer.py - Autonomous Classroom Resource Optimizer Engine
Implements the multi-constraint scoring algorithm for college classroom allocation.
Student-friendly, explainable, and extensible.
"""

from db import get_db_connection

def evaluate_room(room, predicted_students, equipment_needed='Projector', current_room=None, booked_room_ids=None):
    """
    Evaluates a single room against constraints and scores it based on:
    1. Capacity sufficiency (+40)
    2. Operational availability (+30)
    3. Equipment match (+15)
    4. Building / Department preference (+10)
    5. Proximity to current room (+5)
    6. Minimum unused capacity bonus (up to +20)
    """
    if booked_room_ids is None:
        booked_room_ids = []

    room_id = room['room_id']
    capacity = room['capacity']
    is_available = (room['available'] == 'Yes')
    projector_ok = (room['projector_available'] == 'Yes')
    lab_ok = (room['lab_available'] == 'Yes')
    is_booked = (room_id in booked_room_ids)

    score = 0
    reasons = []
    hard_violation = False

    # Constraint 1: Capacity check
    if capacity >= predicted_students:
        score += 40
        reasons.append(f"✓ Sufficient capacity ({capacity} seats >= {predicted_students} students)")
    else:
        hard_violation = True
        reasons.append(f"✗ Capacity deficit ({capacity} seats < {predicted_students} students)")

    # Constraint 2: Room operational availability
    if is_available:
        score += 30
        reasons.append("✓ Room is operational and open")
    else:
        hard_violation = True
        reasons.append("✗ Room is currently unavailable or under maintenance")

    # Constraint 3: Timetable clash check
    if not is_booked:
        score += 20
        reasons.append("✓ No timetable conflict at this time slot")
    else:
        hard_violation = True
        reasons.append("✗ Timetable conflict: already booked for another class")

    # Constraint 4: Equipment check
    if equipment_needed == 'Projector':
        if projector_ok:
            score += 15
            reasons.append("✓ Projector available")
        else:
            reasons.append("⚠ Projector missing")
    elif equipment_needed == 'Lab':
        if lab_ok:
            score += 15
            reasons.append("✓ Computer lab available")
        else:
            hard_violation = True
            reasons.append("✗ Computer lab missing")
    else:
        score += 15

    # Constraint 5: Minimum Unused Capacity (Fit Efficiency)
    unused_seats = capacity - predicted_students
    if unused_seats >= 0:
        # Tighter fit earns higher bonus (maximum +20 points for exact/close fit)
        fit_bonus = max(0, 20 - int(unused_seats / 5))
        score += fit_bonus
        reasons.append(f"✓ Low unused capacity: {unused_seats} spare seats (bonus: +{fit_bonus} pts)")
    else:
        unused_seats = abs(unused_seats)

    # Constraint 6: Proximity check (if current room is known)
    if current_room:
        if room['building'] == current_room['building']:
            score += 10
            reasons.append(f"✓ Same building ({room['building']})")
            if room['floor'] == current_room['floor']:
                score += 5
                reasons.append(f"✓ Same floor ({room['floor']})")
        else:
            score += 2
    else:
        score += 10

    return {
        'room_id': room_id,
        'building': room['building'],
        'floor': room['floor'],
        'capacity': capacity,
        'room_type': room['room_type'],
        'unused_seats': capacity - predicted_students if capacity >= predicted_students else 0,
        'score': score,
        'is_feasible': not hard_violation,
        'reasons': reasons
    }

def recommend_classroom(predicted_students, date=None, time_slot=None, department=None,
                         equipment_needed='Projector', current_room_id=None, exclude_room_ids=None):
    """
    Ranks all available rooms and recommends the best classroom match.
    """
    if exclude_room_ids is None:
        exclude_room_ids = []

    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch all classrooms
    cursor.execute("SELECT * FROM classrooms")
    all_rooms = [dict(row) for row in cursor.fetchall()]

    # Fetch rooms currently booked at this date and time_slot
    booked_room_ids = list(exclude_room_ids)
    if date and time_slot:
        cursor.execute(
            "SELECT room_id FROM timetable WHERE date = ? AND time_slot = ?",
            (date, time_slot)
        )
        for row in cursor.fetchall():
            if current_room_id and row['room_id'] == current_room_id:
                continue  # Don't count the class's own current room as clash
            booked_room_ids.append(row['room_id'])

    current_room = None
    if current_room_id:
        for r in all_rooms:
            if r['room_id'] == current_room_id:
                current_room = r
                break

    evaluated_rooms = []
    for r in all_rooms:
        eval_result = evaluate_room(
            room=r,
            predicted_students=predicted_students,
            equipment_needed=equipment_needed,
            current_room=current_room,
            booked_room_ids=booked_room_ids
        )
        evaluated_rooms.append(eval_result)

    conn.close()

    # Sort rooms: feasible first, then highest score
    evaluated_rooms.sort(key=lambda x: (1 if x['is_feasible'] else 0, x['score']), reverse=True)

    best_match = evaluated_rooms[0] if evaluated_rooms else None

    # Before vs After calculation
    comparison = {}
    if best_match and current_room:
        unused_before = max(0, current_room['capacity'] - predicted_students)
        unused_after = max(0, best_match['capacity'] - predicted_students)
        seats_saved = unused_before - unused_after
        comparison = {
            'current_room_id': current_room['room_id'],
            'current_capacity': current_room['capacity'],
            'recommended_room_id': best_match['room_id'],
            'recommended_capacity': best_match['capacity'],
            'predicted_students': predicted_students,
            'unused_before': unused_before,
            'unused_after': unused_after,
            'seats_saved': seats_saved,
            'is_improvement': seats_saved > 0 or (current_room['capacity'] < predicted_students and best_match['capacity'] >= predicted_students)
        }

    return {
        'best_match': best_match,
        'all_ranked_rooms': evaluated_rooms,
        'comparison': comparison
    }

def batch_optimize_schedule(date=None, department=None, limit=20):
    """
    Scans timetable sessions, identifies suboptimal allocations,
    and produces recommendations for each.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = '''
    SELECT t.id, t.session_id, t.date, t.day, t.time_slot, t.department, t.year, t.section,
           t.subject, t.faculty, t.room_id, c.capacity as current_capacity,
           COALESCE(a.actual_students, a.expected_students, 60) as students
    FROM timetable t
    LEFT JOIN classrooms c ON t.room_id = c.room_id
    LEFT JOIN attendance a ON t.session_id = a.session_id
    WHERE 1=1
    '''
    params = []
    if date:
        query += " AND t.date = ?"
        params.append(date)
    if department and department != 'All':
        query += " AND t.department = ?"
        params.append(department)

    query += " ORDER BY t.id ASC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    sessions = [dict(row) for row in cursor.fetchall()]
    conn.close()

    results = []
    total_seats_saved = 0
    total_conflicts_resolved = 0

    for s in sessions:
        students = s['students']
        current_cap = s['current_capacity'] or 100
        rec = recommend_classroom(
            predicted_students=students,
            date=s['date'],
            time_slot=s['time_slot'],
            department=s['department'],
            current_room_id=s['room_id']
        )
        best = rec['best_match']
        if best:
            unused_before = max(0, current_cap - students)
            unused_after = max(0, best['capacity'] - students)
            saved = unused_before - unused_after
            is_overcapacity = (students > current_cap)
            is_underutilized = (students / current_cap < 0.50 if current_cap else False)

            if saved > 0 or is_overcapacity:
                total_seats_saved += max(0, saved)
                if is_overcapacity and best['capacity'] >= students:
                    total_conflicts_resolved += 1

                results.append({
                    'session': s,
                    'current_room': s['room_id'],
                    'current_capacity': current_cap,
                    'recommended_room': best['room_id'],
                    'recommended_capacity': best['capacity'],
                    'students': students,
                    'unused_before': unused_before,
                    'unused_after': unused_after,
                    'seats_saved': saved,
                    'reasons': best['reasons'],
                    'status': 'Overcapacity Resolved' if is_overcapacity else ('Optimized Space' if saved > 0 else 'Optimal')
                })

    return {
        'recommendations': results,
        'total_seats_saved': total_seats_saved,
        'conflicts_resolved': total_conflicts_resolved
    }
