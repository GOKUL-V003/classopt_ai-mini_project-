import sys
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import db
import app

def test_all():
    print("--- 1. Testing Copilot Scheduling ---")
    client = app.app.test_client()
    res = client.post('/api/ai-chat-copilot', json={'prompt': 'sechdule a meeting of prompt engineering'})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.get_json()
    assert data['success'] is True, "API success should be True"
    assert data.get('action_executed') is True, "action_executed should be True"
    assert data.get('action_type') == 'SCHEDULE_EVENT', f"Wrong action_type: {data.get('action_type')}"
    event_id = data.get('event_id')
    assert event_id is not None, "event_id missing"
    print(f"[PASS] Copilot scheduled meeting with Event ID #{event_id}")

    print("--- 2. Verifying SQLite Database Persistence ---")
    conn = db.get_db_connection()
    event_row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    assert event_row is not None, "Event not found in events table"
    assert "Prompt Engineering" in event_row['event_name'], f"Unexpected name: {event_row['event_name']}"
    print(f"[PASS] Event row in DB: ID={event_row['id']}, Name='{event_row['event_name']}', Room='{event_row['allocated_room_id']}', Date='{event_row['date']}', Status='{event_row['status']}'")

    inst_row = conn.execute("SELECT * FROM ai_chat_instructions WHERE action_type = 'SCHEDULE_EVENT' ORDER BY id DESC LIMIT 1").fetchone()
    assert inst_row is not None, "Instruction row missing from ai_chat_instructions table"
    assert "prompt engineering" in inst_row['user_prompt'].lower(), "Prompt mismatch"
    assert inst_row['execution_status'] == 'SUCCESS', "Execution status not SUCCESS"
    print(f"[PASS] Instruction row in DB: ID={inst_row['id']}, Prompt='{inst_row['user_prompt']}', Action='{inst_row['action_type']}', Status='{inst_row['execution_status']}'")

    print("--- 3. Verifying /api/ai-chat-instructions Endpoint ---")
    res_inst = client.get('/api/ai-chat-instructions?limit=10')
    assert res_inst.status_code == 200
    inst_data = res_inst.get_json()
    assert inst_data['success'] is True
    assert len(inst_data['instructions']) > 0
    print(f"[PASS] API returned {len(inst_data['instructions'])} stored instructions")

    print("--- 4. Verifying /events Master Calendar View ---")
    res_events = client.get('/events')
    assert res_events.status_code == 200
    html = res_events.get_data(as_text=True)
    assert "Prompt Engineering Meeting" in html, "Meeting name not rendered on /events"
    print("[PASS] 'Prompt Engineering Meeting' is successfully rendered on /events page table")

    print("--- 5. Verifying /api/book-event Direct Booking ---")
    res_book = client.post('/api/book-event', json={
        'event_name': 'Cloud Security Seminar',
        'event_type': 'Department Seminar',
        'date': '2026-10-20',
        'time_slot': 'Period P4 (12:15 - 01:15)',
        'registration_count': 90,
        'historical_turnout': 75.0,
        'predicted_attendance': 68,
        'allocated_room_id': 'ME201'
    })
    assert res_book.status_code == 200
    book_data = res_book.get_json()
    assert book_data['success'] is True
    print(f"[PASS] Direct event booking created Event #{book_data['event_id']}")

    print("\nALL 5 TEST PHASES PASSED WITH COMPLETE DATABASE PERSISTENCE!")

if __name__ == '__main__':
    test_all()
