"""
simulator.py - What-If Scenario Simulation Engine
Allows administrators to simulate real-world college changes:
- Classroom closures / maintenance
- Sudden attendance surge (e.g. +15%, +30%)
- Room availability shortage
- Adding new batch / class sessions
Clearly marks all output as 'Simulation Result'.
"""

from db import get_db_connection
from optimizer import recommend_classroom

def run_simulation(scenario_type, unavailable_rooms=None, attendance_multiplier=1.0, added_class=None):
    """
    Executes a what-if scenario on active timetable data.
    
    Parameters:
    - scenario_type: 'room_closed', 'attendance_surge', 'shortage', 'add_class'
    - unavailable_rooms: list of room_ids to disable/close
    - attendance_multiplier: float multiplier (e.g. 1.25 for +25% attendance)
    - added_class: dict containing new class details if scenario is 'add_class'
    """
    if unavailable_rooms is None:
        unavailable_rooms = []

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get sample active sessions (e.g. 40 sessions for realistic simulation analysis)
    cursor.execute('''
    SELECT t.id, t.session_id, t.date, t.day, t.time_slot, t.department, t.year, t.section,
           t.subject, t.faculty, t.room_id, c.capacity as current_capacity,
           COALESCE(a.actual_students, a.expected_students, 60) as original_students
    FROM timetable t
    LEFT JOIN classrooms c ON t.room_id = c.room_id
    LEFT JOIN attendance a ON t.session_id = a.session_id
    LIMIT 40
    ''')
    sessions = [dict(row) for row in cursor.fetchall()]

    # Fetch all active rooms
    cursor.execute("SELECT room_id, capacity, available FROM classrooms")
    all_rooms = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # --- BEFORE SIMULATION METRICS ---
    before_rooms_used = len(set(s['room_id'] for s in sessions if s['room_id']))
    before_conflicts = 0
    before_total_used_capacity = 0
    before_total_capacity = 0

    for s in sessions:
        students = s['original_students']
        cap = s['current_capacity'] or 75
        if students > cap:
            before_conflicts += 1
        before_total_used_capacity += students
        before_total_capacity += cap

    before_utilization = round((before_total_used_capacity / before_total_capacity * 100), 1) if before_total_capacity > 0 else 0

    # --- SIMULATE AFTER STATE ---
    simulated_sessions = []
    after_conflicts = 0
    after_total_used_capacity = 0
    after_total_capacity = 0
    after_rooms_used_set = set()
    reallocated_count = 0

    # Add extra class if scenario is 'add_class'
    active_sessions = list(sessions)
    if scenario_type == 'add_class' and added_class:
        active_sessions.insert(0, {
            'id': 99999,
            'session_id': 'SIM_NEW_01',
            'date': added_class.get('date', '2026-10-01'),
            'day': added_class.get('day', 'Wednesday'),
            'time_slot': added_class.get('time_slot', 'P3'),
            'department': added_class.get('department', 'CSE'),
            'year': added_class.get('year', 3),
            'section': added_class.get('section', 'A'),
            'subject': added_class.get('subject', 'Advanced Cloud Computing'),
            'faculty': added_class.get('faculty', 'CSE_F12'),
            'room_id': None,
            'current_capacity': None,
            'original_students': int(added_class.get('expected_students', 70))
        })

    for s in active_sessions:
        sim_students = int(round(s['original_students'] * attendance_multiplier))
        orig_room = s['room_id']
        needs_reallocation = False
        reallocation_reason = ""

        # Condition 1: Room explicitly closed in simulation
        if orig_room in unavailable_rooms:
            needs_reallocation = True
            reallocation_reason = f"Room {orig_room} unavailable in simulation"
        # Condition 2: Attendance surged and exceeds current capacity
        elif s['current_capacity'] and sim_students > s['current_capacity']:
            needs_reallocation = True
            reallocation_reason = f"Overcrowding: {sim_students} students > {s['current_capacity']} capacity"
        # Condition 3: Brand new class with no room
        elif orig_room is None:
            needs_reallocation = True
            reallocation_reason = "New class requiring initial allocation"

        sim_room = orig_room
        sim_cap = s['current_capacity'] or 75

        if needs_reallocation:
            # Run optimizer with unavailable rooms excluded
            rec = recommend_classroom(
                predicted_students=sim_students,
                date=s['date'],
                time_slot=s['time_slot'],
                department=s['department'],
                exclude_room_ids=unavailable_rooms
            )
            best = rec['best_match']
            if best and best['is_feasible']:
                sim_room = best['room_id']
                sim_cap = best['capacity']
                reallocated_count += 1
            else:
                after_conflicts += 1  # No suitable alternative found

        if sim_students > sim_cap:
            after_conflicts += 1

        if sim_room:
            after_rooms_used_set.add(sim_room)
            after_total_used_capacity += sim_students
            after_total_capacity += sim_cap

        simulated_sessions.append({
            'session_id': s['session_id'],
            'subject': s['subject'],
            'department': s['department'],
            'time_slot': s['time_slot'],
            'students_before': s['original_students'],
            'students_after': sim_students,
            'room_before': orig_room or 'None',
            'room_after': sim_room,
            'capacity_after': sim_cap,
            'was_reallocated': needs_reallocation,
            'reason': reallocation_reason if needs_reallocation else 'Remains in optimal room'
        })

    after_rooms_used = len(after_rooms_used_set)
    after_utilization = round((after_total_used_capacity / after_total_capacity * 100), 1) if after_total_capacity > 0 else 0

    return {
        'is_simulation': True,
        'badge': 'Simulation Result',
        'scenario_type': scenario_type,
        'before': {
            'rooms_used': before_rooms_used,
            'conflicts': before_conflicts,
            'average_utilization': before_utilization,
            'total_students': before_total_used_capacity
        },
        'after': {
            'rooms_used': after_rooms_used,
            'conflicts': after_conflicts,
            'average_utilization': after_utilization,
            'total_students': after_total_used_capacity,
            'reallocated_count': reallocated_count
        },
        'delta': {
            'rooms_used_diff': after_rooms_used - before_rooms_used,
            'conflicts_diff': after_conflicts - before_conflicts,
            'utilization_diff': round(after_utilization - before_utilization, 1)
        },
        'simulated_sessions': simulated_sessions[:15]  # Top simulated sessions for clean UI display
    }
