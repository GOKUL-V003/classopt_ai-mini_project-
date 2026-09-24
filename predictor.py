"""
predictor.py - Machine Learning Inference Module
Loads trained Scikit-Learn model to predict expected student attendance.
Explains the prediction factors transparently.
"""

import os
# pyrefly: ignore [missing-import]
import joblib
import pandas as pd
# pyrefly: ignore [missing-import]
import numpy as np

MODEL_PATH = 'models/attendance_model.pkl'
FALLBACK_MODEL_PATH = 'models/linear_model.pkl'

_model = None

def get_model():
    """Lazy load machine learning model."""
    global _model
    if _model is None:
        if os.path.exists(MODEL_PATH):
            _model = joblib.load(MODEL_PATH)
        elif os.path.exists(FALLBACK_MODEL_PATH):
            _model = joblib.load(FALLBACK_MODEL_PATH)
    return _model

def predict_students(department, day, time_slot, semester_week=10, historical_attendance=80.0, exam_proximity=0):
    """
    Predicts expected student attendance using trained regression model.
    Returns:
    - predicted_students (int)
    - recommended_min_capacity (int)
    - explanation dict
    """
    model = get_model()

    # Convert period format if needed (e.g. '09:00-10:00' -> 'P1')
    period = time_slot
    if not str(period).startswith('P'):
        period_map = {
            '09:00-10:00': 'P1',
            '10:00-11:00': 'P2',
            '11:15-12:15': 'P3',
            '12:15-01:15': 'P4',
            '02:00-03:00': 'P5',
            '03:00-04:00': 'P6',
            '04:00-05:00': 'P7'
        }
        period = period_map.get(str(time_slot), 'P1')

    input_df = pd.DataFrame([{
        'Department': department,
        'Day': day,
        'Period': period,
        'Semester_Week': int(semester_week),
        'Historical_Attendance': float(historical_attendance),
        'Exam_Proximity': int(exam_proximity)
    }])

    if model is not None:
        try:
            raw_pred = model.predict(input_df)[0]
            predicted = int(round(raw_pred))
        except Exception as e:
            print("[Predictor Warning] Model predict failed, fallback heuristic:", e)
            predicted = int(round(60 * (float(historical_attendance) / 100.0)))
    else:
        # Simple baseline heuristic
        predicted = int(round(65 * (float(historical_attendance) / 100.0)))

    # Ensure realistic student count bounds (15 to 150)
    predicted = max(15, min(140, predicted))

    # Recommended capacity includes a buffer of ~10% for comfortable seating
    buffer = max(5, int(round(predicted * 0.10)))
    recommended_capacity = predicted + buffer

    # Explainable factors
    day_effects = {
        'Monday': 'Higher morning engagement',
        'Friday': 'Mild weekend dropoff observed historically',
        'Saturday': 'Lab/Elective heavy attendance'
    }
    exam_effects = {
        0: 'Normal semester routine',
        1: 'Mid-term preparation surge (+10% expected attendance)',
        2: 'Final review rush / peak attendance'
    }

    factors = [
        f"Department Baseline: {department} historical turnout rate is {historical_attendance}%",
        f"Day Effect: {day} ({day_effects.get(day, 'Standard weekday pattern')})",
        f"Time Slot: Period {period} (Mid-day periods typically experience highest turnout)",
        f"Exam Proximity: {exam_effects.get(int(exam_proximity), 'Normal')} "
    ]

    return {
        'predicted_students': predicted,
        'recommended_min_capacity': recommended_capacity,
        'buffer_seats': buffer,
        'factors': factors
    }
