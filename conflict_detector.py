"""
conflict_detector.py - Automated Conflict Detection Module
Scans college timetable and classroom assignments to identify:
1. Room Conflicts (Double bookings)
2. Capacity Conflicts (Overcrowding: Students > Capacity)
3. Faculty Conflicts (Same faculty scheduled in 2 places at once)
4. Resource Conflicts (Equipment/Lab missing for specific subject requirements)
"""

from db import get_db_connection

def scan_conflicts(limit=100):
    """
    Scans the database and returns a list of detected conflicts along with
    remedy room recommendations.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    conflicts = []

    # 1. Capacity Conflicts (Students > Room Capacity)
    cursor.execute('''
    SELECT t.id, t.session_id, t.date, t.day, t.time_slot, t.department, t.year, t.section,
           t.subject, t.faculty, t.room_id, c.capacity,
           COALESCE(a.actual_students, a.expected_students, 70) as students
    FROM timetable t
    JOIN classrooms c ON t.room_id = c.room_id
    LEFT JOIN attendance a ON t.session_id = a.session_id
    WHERE students > c.capacity
    LIMIT ?
    ''', (limit,))

    for row in cursor.fetchall():
        r = dict(row)
        deficit = r['students'] - r['capacity']
        # Find suggested larger rooms dynamically from existing classrooms
        cursor.execute('''
        SELECT room_id, capacity FROM classrooms
        WHERE capacity >= ? AND available = 'Yes' AND room_id != ?
        ORDER BY capacity ASC LIMIT 3
        ''', (r['students'], r['room_id']))
        suggested_rows = cursor.fetchall()
        if not suggested_rows:
            cursor.execute('''
            SELECT room_id, capacity FROM classrooms
            WHERE available = 'Yes' AND room_id != ?
            ORDER BY capacity DESC LIMIT 2
            ''', (r['room_id'],))
            suggested_rows = cursor.fetchall()
        suggested = [f"{s['room_id']} ({s['capacity']} seats)" for s in suggested_rows]

        conflicts.append({
            'type': 'Capacity Conflict',
            'severity': 'High',
            'badge_class': 'badge-danger',
            'card_class': 'card-conflict-high',
            'title': f"Capacity Deficit: {r['subject']} ({r['department']}-{r['year']}{r['section']})",
            'date': r['date'],
            'time_slot': r['time_slot'],
            'details': f"Room {r['room_id']} has capacity of {r['capacity']}, but has {r['students']} students (+{deficit} over capacity).",
            'session_id': r['session_id'],
            'room_id': r['room_id'],
            'suggested_rooms': suggested
        })

    # 2. Room Conflicts (Double Booking: same room, same date, same time_slot)
    cursor.execute('''
    SELECT t1.room_id, t1.date, t1.time_slot,
           t1.subject as subject1, t1.faculty as faculty1, t1.department as dept1,
           t2.subject as subject2, t2.faculty as faculty2, t2.department as dept2
    FROM timetable t1
    JOIN timetable t2 ON t1.room_id = t2.room_id
                     AND t1.date = t2.date
                     AND t1.time_slot = t2.time_slot
                     AND t1.id < t2.id
    LIMIT ?
    ''', (limit,))

    for row in cursor.fetchall():
        r = dict(row)
        cursor.execute('''
        SELECT room_id, capacity FROM classrooms
        WHERE room_id != ? AND available = 'Yes'
        ORDER BY capacity ASC LIMIT 3
        ''', (r['room_id'],))
        suggested = [f"{s['room_id']} ({s['capacity']} seats)" for s in cursor.fetchall()]

        conflicts.append({
            'type': 'Room Conflict',
            'severity': 'High',
            'badge_class': 'badge-danger',
            'card_class': 'card-conflict-high',
            'title': f"Double Booking in Room {r['room_id']}",
            'date': r['date'],
            'time_slot': r['time_slot'],
            'details': f"Room {r['room_id']} simultaneously allocated to '{r['subject1']}' ({r['dept1']}) and '{r['subject2']}' ({r['dept2']}).",
            'session_id': f"Clash-{r['room_id']}",
            'room_id': r['room_id'],
            'suggested_rooms': suggested
        })

    # 3. Faculty Conflicts (Same faculty scheduled in 2 rooms at the same time)
    cursor.execute('''
    SELECT t1.faculty, t1.date, t1.time_slot,
           t1.room_id as room1, t1.subject as subject1,
           t2.room_id as room2, t2.subject as subject2
    FROM timetable t1
    JOIN timetable t2 ON t1.faculty = t2.faculty
                     AND t1.date = t2.date
                     AND t1.time_slot = t2.time_slot
                     AND t1.id < t2.id
    WHERE t1.faculty NOT IN ('Faculty Member', 'Staff', 'Faculty', 'TBD', 'Unknown', '')
      AND t1.faculty IS NOT NULL
    LIMIT ?
    ''', (limit,))

    for row in cursor.fetchall():
        r = dict(row)
        conflicts.append({
            'type': 'Faculty Conflict',
            'severity': 'Medium',
            'badge_class': 'badge-warning',
            'card_class': 'card-conflict-medium',
            'title': f"Faculty Clash: {r['faculty']}",
            'date': r['date'],
            'time_slot': r['time_slot'],
            'details': f"Instructor {r['faculty']} is assigned to Room {r['room1']} ({r['subject1']}) and Room {r['room2']} ({r['subject2']}) simultaneously.",
            'session_id': f"FacClash-{r['faculty']}",
            'room_id': f"{r['room1']} & {r['room2']}",
            'suggested_rooms': ["Reschedule time slot or assign co-instructor"]
        })

    # 4. Resource / Equipment Conflicts (e.g. Lab required but room lacks Lab)
    cursor.execute('''
    SELECT t.id, t.session_id, t.date, t.day, t.time_slot, t.department, t.subject, t.faculty,
           t.room_id, c.lab_available, c.projector_available
    FROM timetable t
    JOIN classrooms c ON t.room_id = c.room_id
    WHERE (LOWER(t.subject) LIKE '%lab%' OR LOWER(t.subject) LIKE '%practical%')
      AND c.lab_available != 'Yes'
    LIMIT ?
    ''', (limit,))

    for row in cursor.fetchall():
        r = dict(row)
        cursor.execute("SELECT room_id, capacity FROM classrooms WHERE lab_available = 'Yes' LIMIT 3")
        suggested = [f"{s['room_id']} ({s['capacity']} seats)" for s in cursor.fetchall()]

        conflicts.append({
            'type': 'Resource Conflict',
            'severity': 'Medium',
            'badge_class': 'badge-warning',
            'card_class': 'card-conflict-medium',
            'title': f"Lab Equipment Missing: {r['subject']}",
            'date': r['date'],
            'time_slot': r['time_slot'],
            'details': f"Practical lab subject '{r['subject']}' is assigned to standard classroom {r['room_id']} without lab facilities.",
            'session_id': r['session_id'],
            'room_id': r['room_id'],
            'suggested_rooms': suggested
        })

    conn.close()
    return conflicts
