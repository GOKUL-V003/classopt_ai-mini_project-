import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const filename = file.name || 'uploaded_dataset.csv';

    // Forward to Flask backend if running
    try {
      const flaskFormData = new FormData();
      flaskFormData.append('file', file);

      const flaskRes = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: flaskFormData,
      });

      if (flaskRes.ok) {
        const data = await flaskRes.json();
        return NextResponse.json(data);
      }
    } catch {
      // If Flask is unreachable, fallback to client/Node CSV parser below
    }

    // In-memory fallback parser for CSV files
    const fileText = await file.text();
    const lines = fileText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return NextResponse.json({ success: false, error: 'The uploaded file is empty' }, { status: 400 });
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows = [];
    let duplicateCount = 0;
    const seen = new Set();

    for (let i = 1; i < lines.length; i++) {
      const lineStr = lines[i];
      if (seen.has(lineStr)) {
        duplicateCount++;
      } else {
        seen.add(lineStr);
      }

      const values = lineStr.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      const obj = {};
      headers.forEach((h, colIdx) => {
        obj[h] = values[colIdx] !== undefined ? values[colIdx] : '';
      });
      rows.push(obj);
    }

    const preview = rows.slice(0, 15);

    return NextResponse.json({
      success: true,
      filename,
      total_rows: rows.length,
      total_columns: headers.length,
      columns: headers,
      missing_values: 0,
      duplicate_rows: duplicateCount,
      preview,
      inspection: {
        total_rows: rows.length,
        total_cols: headers.length,
        columns: headers,
        missing_values: 0,
        duplicate_rows: duplicateCount,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
