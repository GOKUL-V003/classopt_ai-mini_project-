"""
event_predictor.py - College Event Attendance & Hall Allocator
Predicts expected turnout for academic and campus events based on registrations,
event type turnout benchmarks, and historical attendance rates.
Recommends optimal seminar halls / auditoriums without complicated ML.
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

def predict_event_resource(event_name, event_type, date, registration_count, historical_turnout_rate=None, duration_hours=2):
    """
    Predicts expected event attendees and finds the most suitable college venue.
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

    # Prefer Seminar Halls or Lecture Halls first if capacity fits, else largest classrooms
    suitable_rooms = []
    for r in rooms:
        cap = r['capacity']
        if cap >= expected_attendees:
            # Score hall suitability
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
    best_venue = suitable_rooms[0] if suitable_rooms else (rooms[-1] if rooms else None)

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
        'alternative_venues': suitable_rooms[1:4] if len(suitable_rooms) > 1 else [],
        'explanation': (
            f"Based on {round(turnout_rate * 100)}% benchmark attendance for '{event_type}', "
            f"we project ~{expected_attendees} students from {registration_count} registrations. "
            f"Including a 10% safety buffer (+{safety_buffer_seats} seats), venue requires minimum {recommended_min_capacity} seats."
        )
    }
