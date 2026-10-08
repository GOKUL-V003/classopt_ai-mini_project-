"""
db.py - Database module for AI Classroom Resource Optimization System.
Uses SQLite for simple, lightweight, reliable student-level storage.
"""

import sqlite3
import os
import pandas as pd

import json

DB_PATH = 'classroom_optimizer.db'

def get_db_connection():
    """Create and return a database connection with dictionary row access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create database tables if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Classrooms table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS classrooms (
        room_id TEXT PRIMARY KEY,
        building TEXT,
        floor INTEGER,
        capacity INTEGER,
        room_type TEXT,
        projector_available TEXT DEFAULT 'Yes',
        lab_available TEXT DEFAULT 'No',
        available TEXT DEFAULT 'Yes'
    )
    ''')

    # 2. Timetable table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS timetable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        date TEXT,
        day TEXT,
        time_slot TEXT,
        department TEXT,
        year INTEGER,
        section TEXT,
        subject TEXT,
        faculty TEXT,
        room_id TEXT
    )
    ''')

    # 3. Attendance table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        date TEXT,
        day TEXT,
        time_slot TEXT,
        department TEXT,
        year INTEGER,
        section TEXT,
        subject TEXT,
        faculty TEXT,
        room_id TEXT,
        expected_students INTEGER,
        actual_students INTEGER,
        historical_attendance REAL DEFAULT 75.0,
        exam_proximity INTEGER DEFAULT 0
    )
    ''')

    # 4. Events table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_name TEXT,
        event_type TEXT,
        date TEXT,
        time_slot TEXT,
        registration_count INTEGER,
        historical_turnout REAL,
        predicted_attendance INTEGER,
        allocated_room_id TEXT,
        status TEXT DEFAULT 'Scheduled'
    )
    ''')

    # 5. Allocations approval log
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS approved_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        original_room TEXT,
        recommended_room TEXT,
        students INTEGER,
        capacity_before INTEGER,
        capacity_after INTEGER,
        seats_saved INTEGER,
        approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
    )
    ''')

    # 6. AI Chat Instructions & Action Logs table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS ai_chat_instructions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_prompt TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_payload TEXT,
        execution_status TEXT DEFAULT 'SUCCESS',
        ai_response TEXT NOT NULL,
        source TEXT DEFAULT 'SmartOccupy Copilot'
    )
    ''')

    conn.commit()
    conn.close()

def log_ai_instruction(user_prompt, action_type, action_payload=None, execution_status='SUCCESS', ai_response='', source='SmartOccupy Copilot'):
    """Logs an AI bot instruction, executed action, and response into SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    payload_str = json.dumps(action_payload) if isinstance(action_payload, (dict, list)) else str(action_payload or '')
    cursor.execute('''
    INSERT INTO ai_chat_instructions (user_prompt, action_type, action_payload, execution_status, ai_response, source)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', (user_prompt, action_type, payload_str, execution_status, ai_response, source))
    conn.commit()
    inst_id = cursor.lastrowid
    conn.close()
    return inst_id

def get_ai_instructions(limit=50):
    """Retrieves recent AI instructions logged in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ai_chat_instructions ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def insert_event(event_name, event_type, date, time_slot, registration_count, historical_turnout, predicted_attendance, allocated_room_id, status='Scheduled'):
    """Inserts a new event/meeting directly into the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO events (event_name, event_type, date, time_slot, registration_count, historical_turnout, predicted_attendance, allocated_room_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (event_name, event_type, date, time_slot, registration_count, historical_turnout, predicted_attendance, allocated_room_id, status))
    conn.commit()
    event_id = cursor.lastrowid
    conn.close()
    return event_id

def seed_demo_data_if_empty():
    """Populates the database from generated sample CSVs if tables are empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM classrooms")
    room_count = cursor.fetchone()[0]

    if room_count == 0:
        print("[DB] Seeding classrooms from data/classrooms.csv...")
        if os.path.exists('data/classrooms.csv'):
            df_rooms = pd.read_csv('data/classrooms.csv')
            df_rooms.to_sql('classrooms', conn, if_exists='append', index=False)

    cursor.execute("SELECT COUNT(*) FROM timetable")
    timetable_count = cursor.fetchone()[0]

    if timetable_count == 0:
        print("[DB] Seeding timetable from data/timetable.csv (5,000 sessions)...")
        if os.path.exists('data/timetable.csv'):
            df_tt = pd.read_csv('data/timetable.csv')
            df_tt.to_sql('timetable', conn, if_exists='append', index=False)

    cursor.execute("SELECT COUNT(*) FROM attendance")
    attendance_count = cursor.fetchone()[0]

    if attendance_count == 0:
        print("[DB] Seeding attendance from data/attendance.csv (5,000 sessions)...")
        if os.path.exists('data/attendance.csv'):
            df_att = pd.read_csv('data/attendance.csv')
            df_att.to_sql('attendance', conn, if_exists='append', index=False)

    # Insert sample events if empty
    cursor.execute("SELECT COUNT(*) FROM events")
    if cursor.fetchone()[0] == 0:
        cursor.executemany('''
        INSERT INTO events (event_name, event_type, date, time_slot, registration_count, historical_turnout, predicted_attendance, allocated_room_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', [
            ('National AI Symposium 2026', 'Technical Symposium', '2026-10-15', 'P3-P6', 160, 80.0, 128, 'R204', 'Confirmed'),
            ('Industry Expert Guest Lecture', 'Guest Lecture', '2026-10-18', 'P2-P3', 95, 75.0, 71, 'R201', 'Confirmed'),
            ('Web3 Hackathon Orientation', 'Workshop', '2026-10-22', 'P4-P7', 120, 70.0, 84, 'R202', 'Scheduled')
        ])

    conn.commit()
    conn.close()
    print("[DB] Database initialization & seeding completed.")

def reset_to_demo_data():
    """Clears all tables and restores the pre-loaded 5,000 collegiate records."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM classrooms")
    cursor.execute("DELETE FROM timetable")
    cursor.execute("DELETE FROM attendance")
    cursor.execute("DELETE FROM approved_allocations")
    conn.commit()
    conn.close()
    seed_demo_data_if_empty()

def sync_dataset_to_db(df):
    """
    Synchronizes an uploaded or cleaned DataFrame into SQLite tables:
    - classrooms
    - timetable
    - attendance
    Ensures that the Analytics Dashboard, Conflict Scanner, and Optimizer
    reflect the newly uploaded/cleaned data immediately.
    """
    import re
    if df is None or len(df) == 0:
        return {'success': False, 'message': 'Dataset is empty.'}

    # Normalize column names
    col_map = {}
    for col in df.columns:
        c = str(col).strip().lower()
        if c in ['room_id', 'room', 'classroom', 'room_no', 'room_number', 'roomid', 'room id']:
            col_map[col] = 'room_id'
        elif c in ['capacity', 'room_capacity', 'seating_capacity', 'seats', 'total_seats', 'room capacity']:
            col_map[col] = 'capacity'
        elif c in ['building', 'block', 'wing', 'building_name']:
            col_map[col] = 'building'
        elif c in ['floor', 'level']:
            col_map[col] = 'floor'
        elif c in ['room_type', 'type', 'room type']:
            col_map[col] = 'room_type'
        elif c in ['projector_available', 'projector', 'has_projector']:
            col_map[col] = 'projector_available'
        elif c in ['lab_available', 'lab', 'has_lab', 'is_lab']:
            col_map[col] = 'lab_available'
        elif c in ['available', 'room_available', 'status', 'is_available']:
            col_map[col] = 'available'
        elif c in ['session_id', 'id', 'session', 'session id']:
            col_map[col] = 'session_id'
        elif c in ['date', 'session_date', 'date_of_session']:
            col_map[col] = 'date'
        elif c in ['day', 'day_of_week']:
            col_map[col] = 'day'
        elif c in ['time_slot', 'period', 'slot', 'time', 'timeslot']:
            col_map[col] = 'time_slot'
        elif c in ['department', 'dept', 'branch']:
            col_map[col] = 'department'
        elif c in ['year', 'academic_year']:
            col_map[col] = 'year'
        elif c in ['section', 'sec']:
            col_map[col] = 'section'
        elif c in ['subject', 'course', 'subject_name', 'course_name', 'subject title']:
            col_map[col] = 'subject'
        elif c in ['faculty', 'professor', 'teacher', 'instructor']:
            col_map[col] = 'faculty'
        elif c in ['expected_students', 'expected_student_count', 'class_size', 'enrolled_students', 'strength', 'expected students']:
            col_map[col] = 'expected_students'
        elif c in ['actual_students', 'actual_student_count', 'attended_students', 'students_present', 'attendance_count', 'present students', 'present_students', 'present']:
            col_map[col] = 'actual_students'
        elif c in ['historical_attendance', 'historical_turnout', 'historical_rate', 'attendance %', 'attendance_percent', 'attendance percentage']:
            col_map[col] = 'historical_attendance'
        elif c in ['occupancy %', 'occupancy_percent', 'occupancy percentage']:
            col_map[col] = 'occupancy_percentage'
        elif c in ['exam_proximity', 'exam_flag', 'exams']:
            col_map[col] = 'exam_proximity'

    norm_df = df.rename(columns=col_map).copy()
    conn = get_db_connection()
    cursor = conn.cursor()

    is_classrooms_only = ('room_id' in norm_df.columns and 'capacity' in norm_df.columns and 
                          'time_slot' not in norm_df.columns and 'subject' not in norm_df.columns and 
                          'actual_students' not in norm_df.columns)

    if is_classrooms_only:
        # User uploaded standalone classroom master file
        cursor.execute("DELETE FROM classrooms")
        for _, r in norm_df.iterrows():
            rid = str(r['room_id']).strip()
            cap = int(r.get('capacity', 60))
            bld = str(r.get('building', 'Main Block'))
            fl = int(r.get('floor', 1))
            rtype = str(r.get('room_type', 'Lecture Hall' if cap >= 120 else ('Seminar Hall' if cap >= 80 else 'Classroom')))
            proj = 'Yes' if str(r.get('projector_available', 'Yes')).strip().lower() in ['yes', '1', 'true'] else 'No'
            lab = 'Yes' if str(r.get('lab_available', 'No')).strip().lower() in ['yes', '1', 'true'] else 'No'
            avail = 'Yes' if str(r.get('available', 'Yes')).strip().lower() in ['yes', '1', 'true'] else 'No'
            cursor.execute('''
                INSERT OR REPLACE INTO classrooms (room_id, building, floor, capacity, room_type, projector_available, lab_available, available)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (rid, bld, fl, cap, rtype, proj, lab, avail))
        conn.commit()
        conn.close()
        return {'success': True, 'records': len(norm_df), 'type': 'classrooms'}

    # If dataset has room_id, extract unique classrooms and sync classrooms table
    if 'room_id' in norm_df.columns:
        cursor.execute("DELETE FROM classrooms")
        unique_rooms = norm_df[['room_id']].drop_duplicates()
        for _, r_unique in unique_rooms.iterrows():
            rid = str(r_unique['room_id']).strip()
            sub = norm_df[norm_df['room_id'] == r_unique['room_id']]
            first_row = sub.iloc[0]
            cap_val = 60
            if 'capacity' in norm_df.columns:
                try:
                    cap_val = int(first_row['capacity'])
                except (ValueError, TypeError):
                    cap_val = 60
            bld_val = str(first_row.get('building', 'Main Block'))
            m = re.search(r'\d+', rid)
            fl_val = int(m.group(0)[0]) if m and len(m.group(0)) >= 2 else 1
            rtype_val = str(first_row.get('room_type', 'Lecture Hall' if cap_val >= 120 else ('Seminar Hall' if cap_val >= 80 else 'Classroom')))
            proj_val = 'Yes' if str(first_row.get('projector_available', 'Yes')).strip().lower() in ['yes', '1', 'true'] else 'No'
            lab_val = 'Yes' if str(first_row.get('lab_available', 'No')).strip().lower() in ['yes', '1', 'true'] else 'No'
            avail_val = 'Yes' if str(first_row.get('available', 'Yes')).strip().lower() in ['yes', '1', 'true'] else 'No'
            cursor.execute('''
                INSERT OR REPLACE INTO classrooms (room_id, building, floor, capacity, room_type, projector_available, lab_available, available)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (rid, bld_val, fl_val, cap_val, rtype_val, proj_val, lab_val, avail_val))

    # Synchronize attendance and timetable tables
    cursor.execute("DELETE FROM attendance")
    cursor.execute("DELETE FROM timetable")

    # If section column is missing or all rows have identical values,
    # automatically assign distinct sections (Sec A, Sec B, Sec C, Sec D)
    # so parallel sessions running at the same period are clearly identified
    # as distinct student batches/classes rather than showing the same single section
    if 'section' not in norm_df.columns or norm_df['section'].nunique() <= 1:
        sec_letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        norm_df['section'] = norm_df.groupby(['date', 'department', 'time_slot']).cumcount().apply(
            lambda i: sec_letters[i] if i < len(sec_letters) else chr(65 + i)
        )

    att_batch = []
    tt_batch = []

    for idx, r in norm_df.iterrows():
        sess_id = str(r.get('session_id', f'SESS_{idx+1:04d}')).strip()
        dt_raw = str(r.get('date', '2026-09-01'))[:10]
        dy_raw = str(r.get('day', 'Monday'))
        ts_raw = str(r.get('time_slot', 'P1')).strip()
        dept_raw = str(r.get('department', 'CSE')).strip()
        try:
            yr_raw = int(r.get('year', 3))
        except (ValueError, TypeError):
            yr_raw = 3
        sec_raw = str(r.get('section', 'A')).strip()
        subj_raw = str(r.get('subject', 'Core Subject')).strip()
        fac_raw = str(r.get('faculty', 'Faculty Member')).strip()
        rid_raw = str(r.get('room_id', 'R101')).strip()

        # Handle student counts
        has_act = 'actual_students' in norm_df.columns
        has_exp = 'expected_students' in norm_df.columns

        try:
            act_val = int(r['actual_students']) if has_act and pd.notnull(r['actual_students']) else None
        except (ValueError, TypeError):
            act_val = None

        try:
            exp_val = int(r['expected_students']) if has_exp and pd.notnull(r['expected_students']) else None
        except (ValueError, TypeError):
            exp_val = None

        if act_val is None and exp_val is not None:
            act_val = exp_val
        elif exp_val is None and act_val is not None:
            exp_val = act_val
        elif act_val is None and exp_val is None:
            act_val = 50
            exp_val = 55

        try:
            hist_val = float(r['historical_attendance']) if 'historical_attendance' in norm_df.columns and pd.notnull(r['historical_attendance']) else round((act_val / exp_val) * 100, 1) if exp_val > 0 else 75.0
        except (ValueError, TypeError):
            hist_val = 75.0

        try:
            exam_val = int(r['exam_proximity']) if 'exam_proximity' in norm_df.columns and pd.notnull(r['exam_proximity']) else 0
        except (ValueError, TypeError):
            exam_val = 0

        att_batch.append((sess_id, dt_raw, dy_raw, ts_raw, dept_raw, yr_raw, sec_raw, subj_raw, fac_raw, rid_raw, exp_val, act_val, hist_val, exam_val))
        tt_batch.append((sess_id, dt_raw, dy_raw, ts_raw, dept_raw, yr_raw, sec_raw, subj_raw, fac_raw, rid_raw))

    cursor.executemany('''
        INSERT INTO attendance (session_id, date, day, time_slot, department, year, section, subject, faculty, room_id, expected_students, actual_students, historical_attendance, exam_proximity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', att_batch)

    cursor.executemany('''
        INSERT INTO timetable (session_id, date, day, time_slot, department, year, section, subject, faculty, room_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', tt_batch)

    conn.commit()
    conn.close()
    return {'success': True, 'records': len(norm_df), 'type': 'full'}

if __name__ == '__main__':
    init_db()
    seed_demo_data_if_empty()
