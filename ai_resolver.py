"""
ai_resolver.py - Real-Time AI Conflict Resolution & Remedy Engine
Provides intelligent, multi-constraint schedule conflict diagnosis,
generates actionable remedy plans (via Google Gemini API or SmartOccupy AI Engine),
and applies database reallocations in real time.
"""

import os
import json
import requests
from db import get_db_connection
from optimizer import recommend_classroom

# Supported Gemini text generation models (in order of priority)
GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-1.5-pro'
]

def call_gemini_api(prompt_text, api_key=None, system_context=None):
    """
    Attempts to call Google Gemini API directly using the supplied key or environment variable.
    Returns dict with {'success': True, 'text': ..., 'model': ...} or {'success': False, 'error': ...}.
    """
    clean_key = (api_key or os.environ.get('GEMINI_API_KEY', '')).strip()
    if not clean_key:
        return {'success': False, 'error': 'No API key provided'}

    sys_instruction = system_context or (
        "You are SmartOccupy AI Copilot, an expert college classroom and timetable optimization system. "
        "College dataset context: 5,000 timetable sessions across departments: CSE, AIDS, IT, ECE, EEE. "
        "Classrooms: R101 (30 seats), R102 (40 seats), R103 (50 seats), R104 (60 seats), R105 (75 seats), "
        "R201 (90 seats, Lab), R202 (100 seats, Seminar), R203 (120 seats, Lecture), R204 (150 seats, Lecture). "
        "Formulas: Occupancy % = (actual_students / room_capacity) * 100, Utilization % = (used_hours / 40) * 100. "
        "Provide direct, concise, authoritative, professional explanations suitable for academic deans and students."
    )

    full_prompt = f"{sys_instruction}\n\nTask:\n{prompt_text}"

    # Step 1: Attempt model discovery for this specific key
    discovered_models = []
    discovery_error = None
    try:
        disc_res = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={clean_key}",
            timeout=5
        )
        if disc_res.status_code == 200:
            disc_data = disc_res.json()
            for m in disc_data.get('models', []):
                m_name = m.get('name', '').replace('models/', '').lower()
                methods = m.get('supportedGenerationMethods', [])
                if 'generateContent' in methods and not any(bad in m_name for bad in ['tts', 'audio', 'embed', 'imagen']):
                    discovered_models.append(m.get('name', '').replace('models/', ''))
        elif disc_res.status_code in [400, 401, 403]:
            err_data = disc_res.json().get('error', {})
            discovery_error = err_data.get('message', 'API key invalid or unauthorized')
    except Exception as e:
        discovery_error = str(e)

    # Sort discovered models so flash text models are prioritized
    discovered_models.sort(key=lambda n: (
        100 if '2.0-flash' in n else (
            90 if '1.5-flash' in n else (
                80 if 'flash' in n else 10
            )
        )
    ), reverse=True)

    candidate_models = discovered_models + [m for m in GEMINI_MODELS if m not in discovered_models]
    last_error = discovery_error

    # Step 2: Try candidate models across v1beta and v1
    for model in candidate_models:
        for ver in ['v1beta', 'v1']:
            try:
                url = f"https://generativelanguage.googleapis.com/{ver}/models/{model}:generateContent?key={clean_key}"
                payload = {
                    "contents": [
                        {
                            "parts": [{"text": full_prompt}]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 600
                    }
                }
                resp = requests.post(url, json=payload, timeout=8)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get('candidates', [])
                    if candidates and 'content' in candidates[0]:
                        parts = candidates[0]['content'].get('parts', [])
                        if parts and 'text' in parts[0]:
                            return {
                                'success': True,
                                'text': parts[0]['text'].strip(),
                                'model': model
                            }
                else:
                    err_json = resp.json().get('error', {})
                    last_error = err_json.get('message', f"HTTP {resp.status_code}")
                    # If key is rejected as invalid, abort immediately to avoid waiting through all models
                    if resp.status_code in [400, 401] and ('key' in last_error.lower() or 'unregistered' in last_error.lower()):
                        return {'success': False, 'error': last_error}
            except Exception as e:
                last_error = str(e)
                continue

    return {'success': False, 'error': last_error or 'Could not connect to Gemini model'}


def get_conflict_ai_remedy(conflict, api_key=None):
    """
    Analyzes an active timetable conflict using the 6-constraint optimization algorithm,
    finds the optimal available remedy room, and produces natural language diagnosis
    and an actionable remedy plan.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    c_type = conflict.get('type', 'General Conflict')
    session_id = conflict.get('session_id')
    date = conflict.get('date')
    time_slot = conflict.get('time_slot')
    department = conflict.get('department', 'Engineering')
    subject = conflict.get('subject', 'Class Session')
    current_room = conflict.get('room_id')
    students = int(conflict.get('students', 60))

    # Determine equipment requirement
    needs_lab = 'lab' in subject.lower() or 'practical' in subject.lower() or c_type == 'Resource Conflict'
    equipment_needed = 'Lab' if needs_lab else 'Projector'

    # Retrieve all currently booked rooms at this time slot to prevent any secondary clash
    exclude_rooms = [current_room] if current_room else []
    cursor.execute(
        "SELECT DISTINCT room_id FROM timetable WHERE date = ? AND time_slot = ?",
        (date, time_slot)
    )
    booked_rooms = [row['room_id'] for row in cursor.fetchall() if row['room_id'] != current_room]

    # Run 6-constraint scoring recommendation
    opt_result = recommend_classroom(
        predicted_students=students,
        date=date,
        time_slot=time_slot,
        department=department,
        equipment_needed=equipment_needed,
        current_room_id=current_room,
        exclude_room_ids=booked_rooms
    )

    best_room = opt_result.get('best_match')
    feasible_rooms = [r for r in opt_result.get('all_ranked_rooms', []) if r.get('is_feasible')]

    # Check if a valid remedy room was found
    if not best_room or not best_room.get('is_feasible'):
        # No single room fits without clash at this slot
        conn.close()
        return {
            'success': True,
            'can_resolve': False,
            'session_id': session_id,
            'status': 'no_free_room',
            'title': f"Unresolvable at {time_slot}",
            'diagnosis': (
                f"All {equipment_needed.lower()} classrooms on campus are fully occupied during {date} ({time_slot}) "
                f"or lack sufficient capacity for {students} students."
            ),
            'recommendation': "Reschedule this class session to an alternate time slot (e.g. P1 or P5) or split into 2 lab batches.",
            'ai_source': 'ClassOpt Copilot Multi-Constraint Engine'
        }

    rec_room_id = best_room['room_id']
    rec_capacity = best_room['capacity']
    rec_building = best_room['building']
    rec_floor = best_room['floor']
    score = best_room['score']
    unused_seats = best_room['unused_seats']

    # Retrieve current room capacity
    cursor.execute("SELECT capacity FROM classrooms WHERE room_id = ?", (current_room,))
    row_curr = cursor.fetchone()
    curr_capacity = row_curr['capacity'] if row_curr else 0
    conn.close()

    # Formulate structured prompt for LLM if key is present
    prompt = (
        f"Conflict Type: {c_type}\n"
        f"Session: {session_id} - {subject} ({department})\n"
        f"Current Assignment: Room {current_room} (Capacity: {curr_capacity} seats)\n"
        f"Student Turnout: {students} students\n"
        f"Date & Slot: {date} at {time_slot}\n"
        f"Best Remedy Room Found: Room {rec_room_id} (Capacity: {rec_capacity}, Building: {rec_building}, Floor: {rec_floor}, Score: {score}/100)\n"
        f"Unused spare seats in remedy room: {unused_seats}\n"
        f"Equipment: {equipment_needed}\n\n"
        "Provide: 1) A clear 1-2 sentence diagnosis of the root problem. "
        "2) Why Room " + rec_room_id + " is the optimal solution (mentioning capacity fit and buffer). "
        "3) Benefits (e.g. avoiding overcrowding, proximity, power conservation)."
    )

    gemini_result = call_gemini_api(prompt, api_key=api_key)

    if gemini_result and gemini_result.get('success'):
        diagnosis_text = gemini_result['text']
        ai_source = f"Google Gemini AI ({gemini_result['model']})"
    else:
        # High quality built-in expert explanation
        if c_type == 'Capacity Conflict':
            deficit = students - curr_capacity
            diagnosis_text = (
                f"Critical capacity deficit detected: {subject} ({department}) has {students} enrolled students assigned "
                f"to Room {current_room}, which only seats {curr_capacity}. This creates a shortage of +{deficit} seats, "
                f"leading to physical overcrowding and safety non-compliance."
            )
        elif c_type == 'Room Conflict':
            diagnosis_text = (
                f"Schedule collision detected: Room {current_room} has a simultaneous double-booking collision on {date} at {time_slot}. "
                f"Two separate academic classes cannot share physical space simultaneously."
            )
        elif c_type == 'Resource Conflict':
            diagnosis_text = (
                f"Equipment mismatch: Practical session '{subject}' requires dedicated computer lab facilities, "
                f"but Room {current_room} is designated as a standard classroom without lab terminals."
            )
        else:
            diagnosis_text = (
                f"Timetable imbalance detected for session {session_id} in Room {current_room} during {time_slot}."
            )

        ai_source = "ClassOpt AI Autonomous Copilot Engine"

    action_text = (
        f"Reassign {subject} ({session_id}) from Room {current_room} to Room {rec_room_id} "
        f"({rec_capacity} seats, Floor {rec_floor}, {rec_building})."
    )

    reasons_summary = [
        f"Capacity Fit: {rec_capacity} seats accommodates {students} students with {unused_seats} spare safety buffer seats.",
        f"Zero Timetable Collision: Room {rec_room_id} is completely vacant and verified at {time_slot}.",
        f"Location: Located on Floor {rec_floor} ({rec_building}), minimizing student transit time.",
        f"Constraint Optimization Score: {score}/100."
    ]

    return {
        'success': True,
        'can_resolve': True,
        'session_id': session_id,
        'conflict_type': c_type,
        'subject': subject,
        'department': department,
        'date': date,
        'time_slot': time_slot,
        'original_room': current_room,
        'original_capacity': curr_capacity,
        'recommended_room': rec_room_id,
        'recommended_capacity': rec_capacity,
        'students': students,
        'unused_seats': unused_seats,
        'score': score,
        'diagnosis': diagnosis_text,
        'action_plan': action_text,
        'reasons': reasons_summary,
        'ai_source': ai_source
    }


def execute_reallocation(session_id, new_room_id, original_room=None, notes=None):
    """
    Updates the timetable and attendance tables in the SQLite database to move
    the specified session to the new room, and records an approved allocation log.
    """
    if not session_id or not new_room_id:
        return {'success': False, 'error': 'Missing session_id or new_room_id'}

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Fetch current session details
        cursor.execute("SELECT * FROM timetable WHERE session_id = ?", (session_id,))
        tt_row = cursor.fetchone()
        if not tt_row:
            conn.close()
            return {'success': False, 'error': f"Session {session_id} not found in timetable"}

        orig_room = original_room or tt_row['room_id']
        dept = tt_row['department']
        subject = tt_row['subject']

        # 2. Fetch capacities
        cursor.execute("SELECT capacity FROM classrooms WHERE room_id = ?", (orig_room,))
        row_orig = cursor.fetchone()
        cap_orig = row_orig['capacity'] if row_orig else 0

        cursor.execute("SELECT capacity FROM classrooms WHERE room_id = ?", (new_room_id,))
        row_new = cursor.fetchone()
        cap_new = row_new['capacity'] if row_new else 0

        # 3. Get student attendance count
        cursor.execute("SELECT actual_students, expected_students FROM attendance WHERE session_id = ?", (session_id,))
        att_row = cursor.fetchone()
        students = att_row['actual_students'] if (att_row and att_row['actual_students']) else (
            att_row['expected_students'] if att_row else 60
        )

        seats_saved = max(0, cap_orig - cap_new) if cap_orig > cap_new else 0

        # 4. Update Timetable table
        cursor.execute(
            "UPDATE timetable SET room_id = ? WHERE session_id = ?",
            (new_room_id, session_id)
        )

        # 5. Update Attendance table
        cursor.execute(
            "UPDATE attendance SET room_id = ? WHERE session_id = ?",
            (new_room_id, session_id)
        )

        # 6. Log to approved_allocations table
        notes_str = notes or f"AI Autonomous Resolution: Shifted from {orig_room} to {new_room_id} to resolve conflict."
        cursor.execute('''
        INSERT INTO approved_allocations (
            session_id, original_room, recommended_room, students,
            capacity_before, capacity_after, seats_saved, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            session_id, orig_room, new_room_id, students,
            cap_orig, cap_new, seats_saved, notes_str
        ))

        conn.commit()
        conn.close()

        return {
            'success': True,
            'session_id': session_id,
            'subject': subject,
            'original_room': orig_room,
            'new_room': new_room_id,
            'new_capacity': cap_new,
            'message': f"Session {session_id} ({subject}) successfully reallocated to Room {new_room_id}!"
        }
    except Exception as e:
        conn.rollback()
        conn.close()
        return {'success': False, 'error': f"Database update error: {str(e)}"}


def batch_resolve_all_conflicts(api_key=None, max_resolve=15):
    """
    Scans all conflicts and applies feasible AI remedies in batch.
    Returns details on resolved conflicts and remaining counts.
    """
    from conflict_detector import scan_conflicts

    conflicts = scan_conflicts(limit=max_resolve)
    resolved_items = []
    skipped_items = []

    for c in conflicts:
        if not c.get('session_id') or c.get('session_id', '').startswith('FacClash-'):
            skipped_items.append({'title': c.get('title'), 'reason': 'Faculty clash requires manual instructor change'})
            continue

        remedy = get_conflict_ai_remedy(c, api_key=api_key)
        if remedy.get('success') and remedy.get('can_resolve'):
            res = execute_reallocation(
                session_id=remedy['session_id'],
                new_room_id=remedy['recommended_room'],
                original_room=remedy['original_room'],
                notes="Batch AI Conflict Auto-Resolution"
            )
            if res.get('success'):
                resolved_items.append({
                    'session_id': remedy['session_id'],
                    'subject': remedy['subject'],
                    'from_room': remedy['original_room'],
                    'to_room': remedy['recommended_room'],
                    'reason': remedy['action_plan']
                })
            else:
                skipped_items.append({'session_id': remedy['session_id'], 'reason': res.get('error')})
        else:
            skipped_items.append({'session_id': c.get('session_id'), 'reason': remedy.get('recommendation', 'No free room')})

    # Rescan conflicts after resolution
    remaining_conflicts = scan_conflicts(limit=50)

    return {
        'success': True,
        'resolved_count': len(resolved_items),
        'resolved_items': resolved_items,
        'skipped_count': len(skipped_items),
        'remaining_count': len(remaining_conflicts),
        'message': f"Successfully resolved {len(resolved_items)} schedule conflicts using AI multi-constraint optimization!"
    }
