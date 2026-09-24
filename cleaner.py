"""
cleaner.py - Data Cleaning & Validation Module
Applies simple, transparent Pandas operations to clean college data:
1. Removes duplicate rows
2. Imputes missing values using median/mode
3. Converts dates to standardized datetime format
4. Validates capacity and student attendance bounds
Student-level code with step-by-step clarity.
"""

import pandas as pd
# pyrefly: ignore [missing-import]
import numpy as np

def inspect_data(df):
    """
    Inspects a DataFrame and returns metadata for student review:
    - total rows, total columns, column names, missing count, duplicate count, dtypes
    """
    total_rows = len(df)
    total_cols = len(df.columns)
    missing_count = int(df.isnull().sum().sum())
    missing_by_col = df.isnull().sum().to_dict()
    duplicate_count = int(df.duplicated().sum())
    
    dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

    return {
        'total_rows': total_rows,
        'total_cols': total_cols,
        'columns': list(df.columns),
        'missing_values': missing_count,
        'missing_by_col': missing_by_col,
        'duplicate_rows': duplicate_count,
        'dtypes': dtypes
    }

def clean_college_dataset(df):
    """
    Executes straightforward, step-by-step cleaning:
    1. df.drop_duplicates()
    2. Fill numeric missing values with median
    3. Fill categorical missing values with mode / sensible default
    4. Format date strings
    5. Filter out invalid negative or unrealistic numbers
    """
    cleaned = df.copy()
    steps_taken = []

    # Step 1: Drop Duplicates
    initial_rows = len(cleaned)
    cleaned = cleaned.drop_duplicates()
    dups_removed = initial_rows - len(cleaned)
    if dups_removed > 0:
        steps_taken.append(f"Removed {dups_removed} duplicate rows.")
    else:
        steps_taken.append("Verified: 0 duplicate rows found.")

    # Step 2: Handle Date columns
    for date_col in ['Date', 'date']:
        if date_col in cleaned.columns:
            cleaned[date_col] = pd.to_datetime(cleaned[date_col], errors='coerce').dt.strftime('%Y-%m-%d')
            # Fill missing dates with current / forward fill
            cleaned[date_col] = cleaned[date_col].ffill().fillna('2026-06-01')
            steps_taken.append(f"Standardized date formatting in column '{date_col}'.")

    # Step 3: Handle numeric missing values (median imputation)
    numeric_cols = cleaned.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        null_count = cleaned[col].isnull().sum()
        if null_count > 0:
            median_val = cleaned[col].median()
            cleaned[col] = cleaned[col].fillna(median_val)
            steps_taken.append(f"Imputed {null_count} missing values in '{col}' with median ({round(median_val, 1)}).")

    # Step 4: Handle categorical missing values
    categorical_cols = cleaned.select_dtypes(include=['object']).columns
    for col in categorical_cols:
        null_count = cleaned[col].isnull().sum()
        if null_count > 0:
            mode_val = cleaned[col].mode()[0] if not cleaned[col].mode().empty else 'Unknown'
            cleaned[col] = cleaned[col].fillna(mode_val)
            steps_taken.append(f"Imputed {null_count} missing entries in '{col}' with mode ('{mode_val}').")

    # Step 5: Sanity validation for Classroom Capacity & Attendance
    for cap_col in ['Room_Capacity', 'capacity']:
        if cap_col in cleaned.columns:
            # Capacity must be between 10 and 500
            cleaned[cap_col] = cleaned[cap_col].clip(lower=10, upper=500)
            steps_taken.append(f"Validated capacity limits (10 to 500) for '{cap_col}'.")

    for att_col in ['Actual_Student_Count', 'actual_students']:
        if att_col in cleaned.columns:
            # Attendance must be between 0 and 500
            cleaned[att_col] = cleaned[att_col].clip(lower=0, upper=500)
            steps_taken.append(f"Validated student attendance bounds (0 to 500) for '{att_col}'.")

    return cleaned, steps_taken
