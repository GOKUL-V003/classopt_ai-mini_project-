import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    try {
      const targetUrl = `${BACKEND_URL}/api/prediction-classes${queryString ? '?' + queryString : ''}`;
      const res = await fetch(targetUrl);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // Fallback
    }

    // Default sample classes
    return NextResponse.json({
      success: true,
      total: 5,
      classes: [
        { session_id: 'S001', subject: 'Machine Learning', department: 'CSE', day: 'Monday', time_slot: 'P1 (09:00 - 10:00)', actual_students: 56, historical_attendance: 58, room_id: 'R104', capacity: 60, room_type: 'Classroom' },
        { session_id: 'S002', subject: 'Deep Learning', department: 'AIDS', day: 'Monday', time_slot: 'P2 (10:00 - 11:00)', actual_students: 71, historical_attendance: 72, room_id: 'R105', capacity: 75, room_type: 'Classroom' },
        { session_id: 'S003', subject: 'Cloud Computing', department: 'IT', day: 'Tuesday', time_slot: 'P2 (10:00 - 11:00)', actual_students: 86, historical_attendance: 88, room_id: 'R201', capacity: 90, room_type: 'Lab' },
        { session_id: 'S004', subject: 'VLSI Systems', department: 'ECE', day: 'Wednesday', time_slot: 'P3 (11:15 - 12:15)', actual_students: 47, historical_attendance: 49, room_id: 'R103', capacity: 50, room_type: 'Classroom' },
        { session_id: 'S005', subject: 'Power Electronics', department: 'EEE', day: 'Thursday', time_slot: 'P4 (12:15 - 01:15)', actual_students: 36, historical_attendance: 38, room_id: 'R102', capacity: 40, room_type: 'Classroom' }
      ]
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
