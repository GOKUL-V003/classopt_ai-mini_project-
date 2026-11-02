"""
event_predictor.py - College Event Attendance & Hall Allocator
Predicts expected turnout for academic and campus events based on registrations,
event type turnout benchmarks, and historical attendance rates.
Recommends optimal seminar halls / auditoriums and supports user-preferred venue selection & fixing.
"""

from db import get_db_connection

# Typical college event turnout benchmarks
BENCHMARKS = {
    'Technical Symposium': 0.80,
    'Workshop': 0.85,
    'Guest Lecture': 0.75,
    'Cultural Fest': 0.90,
    'Department Seminar': 0.70,
    'Hackathon': 0.88,
    'Orientation / Induction': 0.92
}

def predict_event_resource(event_name, event_type, date, registration_count, historical_turnout_rate=None, duration_hours=2, preferred_venue=None):
    """
    Predicts expected event attendees and finds or fixes the most suitable college venue.
    Supports user preferred venue specification ('preferred_venue') with constraint validation.
    """
    # 1. Calculate turnout percentage
    if historical_turnout_rate is not None and historical_turnout_rate > 0:
        turnout_rate = float(historical_turnout_rate) / 100.0 if historical_turnout_rate > 1.0 else float(historical_turnout_rate)
    else:
        turnout_rate = BENCHMARKS.get(event_type, 0.78)

    # 2. Predicted attendees with a 10% safety buffer
    raw_prediction = registration_count * turnout_rate
    safety_buffer_seats = int(round(raw_prediction * 0.10))
    expected_attendees = int(round(raw_prediction))
    recommended_min_capacity = expected_attendees + safety_buffer_seats

    # 3. Query available college venues / halls
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT room_id, building, floor, capacity, room_type, projector_available, lab_available, available
    FROM classrooms
    WHERE available = 'Yes'
    ORDER BY capacity ASC
    """)
    rooms = [dict(r) for r in cursor.fetchall()]
    conn.close()

    # Ensure any room with 'lab' in its ID or text is classified as 'Lab'
    for r in rooms:
        if 'lab' in r['room_id'].lower():
            r['room_type'] = 'Lab'
            r['lab_available'] = 'Yes'

    # Build all venues annotated with surplus / deficit relative to expected attendees
    all_annotated_venues = []
    for r in rooms:
        cap = r['capacity']
        diff = cap - expected_attendees
        is_fit = cap >= expected_attendees
        all_annotated_venues.append({
            'room_id': r['room_id'],
            'building': r['building'],
            'floor': r['floor'],
            'capacity': cap,
            'room_type': r['room_type'],
            'diff': diff,
            'is_fit': is_fit,
            'display_label': f"{r['room_id']} — {r['room_type']} ({cap} seats, Fl {r['floor']}, {r['building']})"
        })

    # Find algorithmically recommended rooms (prefer Seminar/Lecture Halls)
    suitable_rooms = []
    for r in rooms:
        cap = r['capacity']
        if cap >= expected_attendees:
            hall_score = 0
            if 'Hall' in r['room_type'] or 'Seminar' in r['room_type']:
                hall_score += 30
            unused = cap - expected_attendees
            hall_score += max(0, 30 - int(unused / 5))

            suitable_rooms.append({
                'room_id': r['room_id'],
                'building': r['building'],
                'floor': r['floor'],
                'capacity': cap,
                'room_type': r['room_type'],
                'unused_seats': unused,
                'score': hall_score
            })

    suitable_rooms.sort(key=lambda x: x['score'], reverse=True)
    algo_best = suitable_rooms[0] if suitable_rooms else (rooms[-1] if rooms else None)

    # 4. Check if user specified a Preferred Venue and fix it
    is_preferred_fixed = False
    venue_warning = None
    venue_notice = None
    best_venue = None

    clean_pref = (preferred_venue or '').strip()
    if clean_pref and clean_pref.lower() not in ['auto', 'none', 'null', '']:
        matched_room = next((r for r in rooms if r['room_id'].lower() == clean_pref.lower()), None)
        if matched_room:
            cap = matched_room['capacity']
            diff = cap - expected_attendees
            best_venue = {
                'room_id': matched_room['room_id'],
                'building': matched_room['building'],
                'floor': matched_room['floor'],
                'capacity': cap,
                'room_type': matched_room['room_type'],
                'unused_seats': diff,
                'score': 100
            }
            is_preferred_fixed = True
            if cap < expected_attendees:
                venue_warning = (
                    f"⚠️ Preferred venue '{matched_room['room_id']}' has capacity of {cap} seats, "
                    f"which is less than predicted attendance of {expected_attendees} students "
                    f"({abs(diff)} seats short). Overcrowding may occur."
                )
            else:
                venue_notice = (
                    f"🔒 User Preferred Venue '{matched_room['room_id']}' fixed. "
                    f"Fits {expected_attendees} students with {diff} surplus seats."
                )

    if not best_venue:
        best_venue = algo_best

    explanation_text = (
        f"Based on {round(turnout_rate * 100)}% benchmark attendance for '{event_type}', "
        f"we project ~{expected_attendees} students from {registration_count} registrations. "
        f"Including a 10% safety buffer (+{safety_buffer_seats} seats), venue requires minimum {recommended_min_capacity} seats."
    )
    if is_preferred_fixed:
        explanation_text += f" Venue explicitly fixed to preferred choice: {best_venue['room_id']}."

    return {
        'event_name': event_name,
        'event_type': event_type,
        'date': date,
        'duration_hours': duration_hours,
        'registration_count': registration_count,
        'turnout_rate_pct': round(turnout_rate * 100, 1),
        'predicted_attendees': expected_attendees,
        'recommended_min_capacity': recommended_min_capacity,
        'best_venue': best_venue,
        'is_preferred_fixed': is_preferred_fixed,
        'venue_warning': venue_warning,
        'venue_notice': venue_notice,
        'alternative_venues': [r for r in suitable_rooms if r['room_id'] != (best_venue['room_id'] if best_venue else '')][:4],
        'all_venues': all_annotated_venues,
        'explanation': explanation_text
    }
