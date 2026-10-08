import sys
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import db
import app

def test_preferred_venue():
    client = app.app.test_client()

    print("--- 1. Testing /api/predict-event with Preferred Venue ---")
    res_pred = client.post('/api/predict-event', json={
        'event_name': 'Robotics Hackathon',
        'event_type': 'Hackathon',
        'date': '2026-10-22',
        'registration_count': 60,
        'preferred_venue': 'ME302'
    })
    assert res_pred.status_code == 200
    pdata = res_pred.get_json()
    assert pdata['is_preferred_fixed'] is True, "is_preferred_fixed should be True"
    assert pdata['best_venue']['room_id'] == 'ME302', f"Expected ME302, got {pdata['best_venue']['room_id']}"
    assert 'all_venues' in pdata and len(pdata['all_venues']) > 0, "all_venues missing"
    print(f"[PASS] Prediction fixed to preferred venue ME302 (Capacity: {pdata['best_venue']['capacity']})")

    print("--- 2. Testing /api/book-event with Fixed Preferred Venue ---")
    res_book = client.post('/api/book-event', json={
        'event_name': 'Robotics Hackathon',
        'event_type': 'Hackathon',
        'date': '2026-10-22',
        'time_slot': 'Period P2 (10:00 - 11:00)',
        'registration_count': 60,
        'predicted_attendance': 53,
        'allocated_room_id': 'ME302',
        'is_preferred_fixed': True
    })
    assert res_book.status_code == 200
    bdata = res_book.get_json()
    assert bdata['success'] is True
    event_id = bdata['event_id']
    assert 'Preferred Venue Fixed' in bdata['status']
    print(f"[PASS] Booked event #{event_id} with status '{bdata['status']}'")

    print("--- 3. Testing /api/fix-event-venue to Override/Change Venue ---")
    res_fix = client.post('/api/fix-event-venue', json={
        'event_id': event_id,
        'preferred_venue': 'SF201'
    })
    assert res_fix.status_code == 200
    fdata = res_fix.get_json()
    assert fdata['success'] is True
    assert fdata['new_room'] == 'SF201'
    print(f"[PASS] Fixed event #{event_id} venue from {fdata['old_room']} to {fdata['new_room']}")

    # Verify directly in SQLite DB
    conn = db.get_db_connection()
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    assert row['allocated_room_id'] == 'SF201', f"Expected SF201 in DB, found {row['allocated_room_id']}"
    assert 'Preferred Venue Fixed' in row['status']
    print(f"[PASS] Database confirmed: allocated_room_id = '{row['allocated_room_id']}', status = '{row['status']}'")

    print("--- 4. Testing Chatbot Scheduling with Preferred Venue Extraction ---")
    res_chat_pref = client.post('/api/ai-chat-copilot', json={
        'prompt': 'Schedule a meeting of prompt engineering in ME201'
    })
    assert res_chat_pref.status_code == 200
    cdata = res_chat_pref.get_json()
    assert cdata['success'] is True
    assert cdata['action_executed'] is True
    assert cdata['event']['allocated_room'] == 'ME201', f"Expected ME201, got {cdata['event']['allocated_room']}"
    assert cdata['event']['is_preferred_fixed'] is True, "is_preferred_fixed should be True for prompt with venue"
    print(f"[PASS] Chatbot detected preferred venue 'ME201' and fixed it for Event #{cdata['event_id']}")

    print("--- 5. Testing Chatbot Intent to Change/Fix Venue of an Existing Event ---")
    res_chat_fix = client.post('/api/ai-chat-copilot', json={
        'prompt': f"Fix venue of event {event_id} to ME302"
    })
    assert res_chat_fix.status_code == 200
    cfix_data = res_chat_fix.get_json()
    assert cfix_data['success'] is True
    assert cfix_data['action_type'] == 'FIX_EVENT_VENUE'
    print(f"[PASS] Chatbot executed FIX_EVENT_VENUE command for Event #{event_id}")

    # Verify DB again
    row2 = conn.execute("SELECT allocated_room_id, status FROM events WHERE id = ?", (event_id,)).fetchone()
    assert row2['allocated_room_id'] == 'ME302', f"Expected ME302 in DB, found {row2['allocated_room_id']}"
    print(f"[PASS] Database confirmed new room: '{row2['allocated_room_id']}'")

    print("--- 6. Verifying /events Template Rendering with Classrooms & Fix Button ---")
    res_html = client.get('/events')
    assert res_html.status_code == 200
    html = res_html.get_data(as_text=True)
    assert 'Fix Venue' in html, "Fix Venue action button missing from table"
    assert 'evt-preferred-venue' in html, "evt-preferred-venue select missing"
    assert 'evt-fix-venue-selector' in html, "evt-fix-venue-selector missing"
    assert 'modal-fix-venue' in html, "modal-fix-venue modal missing"
    print("[PASS] /events template renders Preferred Venue selectors, Fix Venue buttons, and Modal!")

    print("\nALL PREFERRED VENUE TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    test_preferred_venue()
