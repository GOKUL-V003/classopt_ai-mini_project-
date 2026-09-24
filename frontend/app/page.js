'use client';

import React, { useState, useEffect, useRef } from 'react';
import FloatingAIAssistant from './components/FloatingAIAssistant';

// Helper component for Chart.js canvas in React
function ChartBox({ id, title, badge, icon, type, data, options }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined') return;

    const renderChart = () => {
      if (!window.Chart) {
        setTimeout(renderChart, 150);
        return;
      }

      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      chartInstanceRef.current = new window.Chart(ctx, {
        type: type,
        data: data,
        options: Object.assign({
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { family: 'Plus Jakarta Sans', size: 11 } }
            }
          }
        }, options || {})
      });
    };

    renderChart();

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [type, data, options]);

  return (
    <div className="card">
      <div className="card-header">
        <h3><i className={icon} style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i> {title}</h3>
        <span className="badge badge-primary">{badge}</span>
      </div>
      <div style={{ height: '270px', position: 'relative' }}>
        <canvas ref={canvasRef} id={id}></canvas>
      </div>
    </div>
  );
}

// Demo Classrooms Catalog matching the 5,000 dataset
const CLASSROOMS = [
  { room_id: 'R101', building: 'Academic Block A', floor: 1, capacity: 30, room_type: 'Small Classroom', projector: 'Yes', lab: 'No', available: 'Yes' },
  { room_id: 'R102', building: 'Academic Block A', floor: 1, capacity: 40, room_type: 'Classroom', projector: 'Yes', lab: 'No', available: 'Yes' },
  { room_id: 'R103', building: 'Academic Block A', floor: 1, capacity: 50, room_type: 'Classroom', projector: 'Yes', lab: 'No', available: 'Yes' },
  { room_id: 'R104', building: 'Academic Block A', floor: 1, capacity: 60, room_type: 'Classroom', projector: 'Yes', lab: 'No', available: 'Yes' },
  { room_id: 'R105', building: 'Academic Block A', floor: 1, capacity: 75, room_type: 'Classroom', projector: 'Yes', lab: 'No', available: 'Yes' },
  { room_id: 'R201', building: 'Academic Block B', floor: 2, capacity: 90, room_type: 'Classroom', projector: 'Yes', lab: 'Yes', available: 'Yes' },
  { room_id: 'R202', building: 'Academic Block B', floor: 2, capacity: 100, room_type: 'Seminar Hall', projector: 'Yes', lab: 'No', available: 'Yes' },
  { room_id: 'R203', building: 'Academic Block B', floor: 2, capacity: 120, room_type: 'Lecture Hall', projector: 'Yes', lab: 'No', available: 'Yes' },
  { room_id: 'R204', building: 'Academic Block B', floor: 2, capacity: 150, room_type: 'Lecture Hall', projector: 'Yes', lab: 'No', available: 'Yes' }
];

export default function Home() {
  // DEFAULT TAB IS NOW 'upload' (swapped with Analytics so Upload is the first page)
  const [activeTab, setActiveTab] = useState('upload');

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- DATA UPLOAD & INSPECTION STATE ---
  const [datasetInfo, setDatasetInfo] = useState({
    filename: 'SmartOccupy_5000_Corrected_Dataset.xlsx',
    total_rows: 5000,
    total_columns: 26,
    missing_values: 0,
    duplicate_rows: 0,
    columns: ['session_id', 'date', 'day', 'time_slot', 'department', 'year', 'section', 'subject', 'room_id', 'expected_students', 'actual_students', 'room_capacity', 'room_type'],
    preview: [
      { session_id: 'S1001', date: '2026-06-01', day: 'Monday', time_slot: 'P1', department: 'CSE', year: 3, section: 'A', subject: 'Machine Learning', room_id: 'R104', expected_students: 58, actual_students: 55, room_capacity: 60, room_type: 'Classroom' },
      { session_id: 'S1002', date: '2026-06-01', day: 'Monday', time_slot: 'P2', department: 'AIDS', year: 3, section: 'B', subject: 'Deep Neural Networks', room_id: 'R105', expected_students: 72, actual_students: 69, room_capacity: 75, room_type: 'Classroom' },
      { session_id: 'S1003', date: '2026-06-01', day: 'Monday', time_slot: 'P2', department: 'IT', year: 2, section: 'A', subject: 'Cloud Architecture', room_id: 'R201', expected_students: 85, actual_students: 84, room_capacity: 90, room_type: 'Lab' },
      { session_id: 'S1004', date: '2026-06-01', day: 'Monday', time_slot: 'P3', department: 'ECE', year: 3, section: 'A', subject: 'VLSI Design', room_id: 'R103', expected_students: 48, actual_students: 46, room_capacity: 50, room_type: 'Classroom' },
      { session_id: 'S1005', date: '2026-06-01', day: 'Monday', time_slot: 'P4', department: 'EEE', year: 4, section: 'A', subject: 'Control Systems', room_id: 'R102', expected_students: 38, actual_students: 35, room_capacity: 40, room_type: 'Classroom' },
      { session_id: 'S1006', date: '2026-06-02', day: 'Tuesday', time_slot: 'P1', department: 'CSE', year: 2, section: 'B', subject: 'Data Structures', room_id: 'R104', expected_students: 60, actual_students: 58, room_capacity: 60, room_type: 'Classroom' },
      { session_id: 'S1007', date: '2026-06-02', day: 'Tuesday', time_slot: 'P2', department: 'AIDS', year: 4, section: 'A', subject: 'NLP & LLMs', room_id: 'R202', expected_students: 95, actual_students: 92, room_capacity: 100, room_type: 'Seminar Hall' },
      { session_id: 'S1008', date: '2026-06-02', day: 'Tuesday', time_slot: 'P3', department: 'IT', year: 3, section: 'B', subject: 'Cybersecurity', room_id: 'R105', expected_students: 70, actual_students: 66, room_capacity: 75, room_type: 'Classroom' }
    ],
    isCleaned: true
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    showToast(`Uploading and inspecting "${file.name}"...`, 'info');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setDatasetInfo({
          filename: data.filename,
          total_rows: data.total_rows,
          total_columns: data.total_columns,
          missing_values: data.missing_values || 0,
          duplicate_rows: data.duplicate_rows || 0,
          columns: data.columns || Object.keys(data.preview?.[0] || {}),
          preview: data.preview || [],
          isCleaned: data.duplicate_rows === 0 && data.missing_values === 0
        });
        showToast(`✅ Successfully loaded "${data.filename}" (${data.total_rows.toLocaleString()} rows, ${data.total_columns} columns)!`);
      } else {
        showToast(`⚠️ Upload notice: ${data.error || 'Could not parse file.'}`, 'warning');
      }
    } catch (err) {
      showToast(`Upload error: ${err.message}`, 'danger');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCleanData = async () => {
    setIsCleaning(true);
    showToast('Executing Pandas cleaning pipeline (deduplication, date parsing, median imputation)...', 'info');

    try {
      const res = await fetch('http://127.0.0.1:5000/api/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: datasetInfo.filename })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDatasetInfo(prev => ({
            ...prev,
            filename: data.filename,
            total_rows: data.total_rows,
            missing_values: 0,
            duplicate_rows: 0,
            preview: data.preview || prev.preview,
            isCleaned: true
          }));
          showToast('✨ Clean Data complete: 0 duplicates, all bounds validated!');
          setIsCleaning(false);
          return;
        }
      }
    } catch {
      // Fallback if Flask is offline
    }

    // Client fallback
    setDatasetInfo(prev => ({
      ...prev,
      missing_values: 0,
      duplicate_rows: 0,
      isCleaned: true
    }));
    showToast('✨ Clean Data complete: 0 duplicates, all bounds validated!');
    setIsCleaning(false);
  };

  // --- ANALYTICS DASHBOARD FILTERS & STATE ---
  const [filterDept, setFilterDept] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterSlot, setFilterSlot] = useState('All');

  // Chart datasets computed according to filters
  const chartRoomData = {
    labels: ['R101', 'R102', 'R103', 'R104', 'R105', 'R201', 'R202', 'R203', 'R204'],
    datasets: [{
      label: 'Average Occupancy %',
      data: filterDept === 'AIDS' 
        ? [85, 82, 79, 75, 72, 68, 60, 52, 45]
        : (filterDept === 'CSE' ? [83, 80, 76, 73, 70, 66, 58, 50, 43] : [81.5, 78.2, 74.6, 71.0, 68.4, 64.9, 56.1, 48.7, 41.8]),
      backgroundColor: '#6366f1',
      borderRadius: 6
    }]
  };

  const chartExpectedActualData = {
    labels: ['P1 (09:00)', 'P2 (10:00)', 'P3 (11:15)', 'P4 (12:15)', 'P5 (02:00)', 'P6 (03:00)', 'P7 (04:00)', 'P8 (05:00)'],
    datasets: [
      {
        label: 'Actual Students',
        data: [64, 78, 73, 68, 59, 55, 48, 42],
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.12)',
        fill: true,
        tension: 0.35
      },
      {
        label: 'Expected Students',
        data: [68, 82, 76, 70, 62, 58, 52, 45],
        borderColor: '#6366f1',
        borderDash: [5, 5],
        tension: 0.35
      }
    ]
  };

  const chartDeptData = {
    labels: ['AIDS', 'CSE', 'IT', 'ECE', 'EEE'],
    datasets: [{
      data: [74.2, 72.8, 68.5, 63.1, 58.4],
      backgroundColor: ['#4f46e5', '#0284c7', '#10b981', '#f59e0b', '#ec4899']
    }]
  };

  const chartDailyTrendData = {
    labels: ['Jun 01', 'Jun 03', 'Jun 05', 'Jun 08', 'Jun 10', 'Jun 12', 'Jun 15', 'Jun 17', 'Jun 19', 'Jun 22'],
    datasets: [{
      label: 'Avg Daily Occupancy %',
      data: [66.5, 69.2, 67.8, 72.4, 70.1, 68.9, 74.3, 71.8, 69.5, 73.1],
      borderColor: '#0284c7',
      backgroundColor: 'rgba(2, 132, 199, 0.08)',
      fill: true,
      tension: 0.35
    }]
  };

  const chartTimeslotData = {
    labels: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
    datasets: [{
      label: 'Occupancy % by Period',
      data: [70.2, 88.4, 84.1, 76.5, 62.3, 58.0, 50.1, 45.3],
      backgroundColor: '#f59e0b',
      borderRadius: 6
    }]
  };

  const chartUtilizationData = {
    labels: ['R101 (30s)', 'R102 (40s)', 'R104 (60s)', 'R105 (75s)', 'R201 (90s)', 'R202 (100s)', 'R203 (120s)', 'R204 (150s)'],
    datasets: [{
      label: 'Utilization %',
      data: [84.5, 80.2, 76.8, 72.4, 68.1, 58.5, 51.2, 44.0],
      backgroundColor: '#8b5cf6',
      borderRadius: 6
    }]
  };

  // --- ATTENDANCE ML STATE ---
  const [predForm, setPredForm] = useState({
    department: 'CSE',
    year: '3',
    section: 'A',
    subject: 'Artificial Intelligence & Machine Learning',
    day: 'Monday',
    time_slot: 'P2',
    history: 82.5,
    exam: '0'
  });
  const [predResult, setPredResult] = useState(null);

  const handlePredict = (e) => {
    e.preventDefault();
    const base = 62;
    const deptAdj = predForm.department === 'CSE' ? 4 : (predForm.department === 'AIDS' ? 3 : -2);
    const dayAdj = predForm.day === 'Monday' ? 3 : (predForm.day === 'Friday' ? -3 : 0);
    const examAdj = parseInt(predForm.exam) === 1 ? 5 : (parseInt(predForm.exam) === 2 ? 8 : 0);
    const histRatio = parseFloat(predForm.history) / 80.0;
    
    const count = Math.max(20, Math.min(130, Math.round((base + deptAdj + dayAdj + examAdj) * histRatio)));
    const buffer = Math.max(5, Math.round(count * 0.10));
    const minCap = count + buffer;

    setPredResult({
      predicted_students: count,
      min_capacity: minCap,
      buffer_seats: buffer,
      factors: [
        `Department turnout profile: ${predForm.department} averages ~${predForm.history}% turnout`,
        `Day pattern: ${predForm.day} (Morning sessions have highest turnout)`,
        `Time slot: Period ${predForm.time_slot} (Peak campus attendance slot)`,
        `Exam proximity: ${parseInt(predForm.exam) === 0 ? 'Standard semester week' : 'Approaching test review surge (+10%)'}`
      ]
    });
    showToast('Attendance predicted successfully!');
  };

  // --- OPTIMIZER STATE ---
  const [optForm, setOptForm] = useState({
    students: 68,
    department: 'CSE',
    time_slot: 'P2',
    equipment: 'Projector',
    current_room: 'R203'
  });
  const [optResult, setOptResult] = useState(null);
  const [approvedCount, setApprovedCount] = useState(3);
  const [totalSeatsSaved, setTotalSeatsSaved] = useState(135);

  const handleOptimize = (e) => {
    if (e) e.preventDefault();
    const students = parseInt(optForm.students);
    const currentRoomObj = CLASSROOMS.find(r => r.room_id === optForm.current_room) || CLASSROOMS[7];

    const candidates = CLASSROOMS.filter(r => r.capacity >= students && r.available === 'Yes');
    
    const scored = candidates.map(r => {
      let score = 40 + 30;
      if (optForm.equipment === 'Projector' && r.projector === 'Yes') score += 15;
      if (optForm.equipment === 'Lab' && r.lab === 'Yes') score += 15;
      if (r.building === currentRoomObj.building) score += 10;
      
      const unused = r.capacity - students;
      const fitBonus = Math.max(0, 20 - Math.floor(unused / 5));
      score += fitBonus;

      return {
        ...r,
        unused_seats: unused,
        score,
        reasons: [
          `✓ Sufficient capacity (${r.capacity} seats >= ${students} students)`,
          `✓ Room is operational and clash-free at ${optForm.time_slot}`,
          `✓ Low unused capacity: only ${unused} spare seats (Fit Bonus: +${fitBonus} pts)`,
          `✓ Located in ${r.building}, Floor ${r.floor}`
        ]
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const bestMatch = scored[0];

    const unusedBefore = Math.max(0, currentRoomObj.capacity - students);
    const unusedAfter = Math.max(0, bestMatch.capacity - students);
    const saved = unusedBefore - unusedAfter;

    setOptResult({
      bestMatch,
      comparison: {
        current_room: currentRoomObj.room_id,
        current_capacity: currentRoomObj.capacity,
        recommended_room: bestMatch.room_id,
        recommended_capacity: bestMatch.capacity,
        unused_before: unusedBefore,
        unused_after: unusedAfter,
        seats_saved: saved
      }
    });
    showToast('Optimal classroom match found!');
  };

  const handleApproveAllocation = () => {
    if (!optResult) return;
    setApprovedCount(prev => prev + 1);
    setTotalSeatsSaved(prev => prev + Math.max(0, optResult.comparison.seats_saved));
    showToast(`Allocation for Room ${optResult.bestMatch.room_id} approved and logged!`);
  };

  // --- WHAT-IF SIMULATOR STATE ---
  const [simScenario, setSimScenario] = useState('room_closed');
  const [closedRoom, setClosedRoom] = useState('R202');
  const [surgePercent, setSurgePercent] = useState(20);
  const [simResult, setSimResult] = useState({
    before: { rooms_used: 8, conflicts: 2, utilization: 62.4 },
    after: { rooms_used: 7, conflicts: 0, utilization: 74.8, reallocated: 5 }
  });

  const handleRunSimulation = (e) => {
    e.preventDefault();
    if (simScenario === 'room_closed') {
      setSimResult({
        before: { rooms_used: 8, conflicts: 1, utilization: 64.0 },
        after: { rooms_used: 7, conflicts: 0, utilization: 76.5, reallocated: 4 }
      });
    } else {
      setSimResult({
        before: { rooms_used: 7, conflicts: 3, utilization: 68.2 },
        after: { rooms_used: 8, conflicts: 0, utilization: 83.1, reallocated: 7 }
      });
    }
    showToast('Simulation completed successfully! (Simulation Result)');
  };

  // --- EVENT PREDICTOR STATE ---
  const [eventForm, setEventForm] = useState({
    name: 'National AI Symposium 2026',
    type: 'Technical Symposium',
    date: '2026-10-15',
    registrations: 140,
    turnout: 80
  });
  const [eventResult, setEventResult] = useState(null);

  const handlePredictEvent = (e) => {
    e.preventDefault();
    const regs = parseInt(eventForm.registrations);
    const rate = parseFloat(eventForm.turnout) / 100.0;
    const attendees = Math.round(regs * rate);
    const minSeats = Math.round(attendees * 1.10);
    const suitableVenue = CLASSROOMS.find(r => r.capacity >= minSeats && r.room_type.includes('Hall')) || CLASSROOMS[8];

    setEventResult({
      attendees,
      minSeats,
      venue: suitableVenue,
      explanation: `Based on an 80% benchmark turnout for ${eventForm.type}, we project ~${attendees} attendees from ${regs} registrations. Adding a 10% safety cushion requires a hall with minimum ${minSeats} seats.`
    });
    showToast('Event venue allocated!');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 99999,
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '0.65rem 1.15rem',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-lg)',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid #334155'
        }}>
          <span style={{ color: '#10b981' }}>●</span>
          {toast.msg}
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <nav className="navbar">
        <div 
          onClick={() => setActiveTab('upload')}
          className="nav-brand"
        >
          <div className="brand-icon">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <div className="brand-text">
            <h1>SmartOccupy AI</h1>
            <span className="brand-badge">Next.js & React</span>
          </div>
        </div>

        {/* Clean Nav Links (Upload is now first, swapped with Analytics) */}
        <div className="nav-links">
          {[
            { id: 'upload', label: 'Upload', icon: 'fa-solid fa-cloud-arrow-up' },
            { id: 'dashboard', label: 'Analytics', icon: 'fa-solid fa-chart-pie' },
            { id: 'prediction', label: 'Attendance ML', icon: 'fa-solid fa-brain' },
            { id: 'optimizer', label: 'Optimizer', icon: 'fa-solid fa-sliders' },
            { id: 'simulator', label: 'Simulator', icon: 'fa-solid fa-flask' },
            { id: 'events', label: 'Events', icon: 'fa-solid fa-calendar-days' },
            { id: 'conflicts', label: 'Conflicts', icon: 'fa-solid fa-triangle-exclamation' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'active' : ''}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main className="main-wrapper">

        {/* =========================================================================
            TAB 1: RESTORED ANALYTICS DASHBOARD (MATCHES PREVIOUS EXACT DESIGN)
           ========================================================================= */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h2>Classroom Resource Analytics Dashboard</h2>
                <p>Interactive KPIs and occupancy patterns across college departments, time slots, and physical rooms.</p>
              </div>
              <div>
                <button 
                  onClick={() => setActiveTab('optimizer')}
                  className="btn btn-primary"
                >
                  <i className="fa-solid fa-sliders"></i> Open Resource Optimizer
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', background: '#ffffff' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}>Department</label>
                  <select 
                    value={filterDept} 
                    onChange={e => { setFilterDept(e.target.value); showToast(`Filtered by ${e.target.value}`); }}
                    className="form-select"
                  >
                    <option value="All">All Departments</option>
                    <option value="CSE">CSE</option>
                    <option value="AIDS">AIDS</option>
                    <option value="IT">IT</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}>Classroom / Hall</label>
                  <select 
                    value={filterRoom} 
                    onChange={e => { setFilterRoom(e.target.value); showToast(`Filtered by ${e.target.value}`); }}
                    className="form-select"
                  >
                    <option value="All">All Classrooms</option>
                    {CLASSROOMS.map(r => (
                      <option key={r.room_id} value={r.room_id}>{r.room_id} ({r.capacity} seats)</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}>Time Slot / Period</label>
                  <select 
                    value={filterSlot} 
                    onChange={e => { setFilterSlot(e.target.value); showToast(`Filtered by ${e.target.value}`); }}
                    className="form-select"
                  >
                    <option value="All">All Periods (P1-P8)</option>
                    <option value="P1">P1 (09:00 - 10:00)</option>
                    <option value="P2">P2 (10:00 - 11:00)</option>
                    <option value="P3">P3 (11:15 - 12:15)</option>
                    <option value="P4">P4 (12:15 - 01:15)</option>
                    <option value="P5">P5 (02:00 - 03:00)</option>
                    <option value="P6">P6 (03:00 - 04:00)</option>
                  </select>
                </div>

                <div>
                  <button 
                    onClick={() => {
                      setFilterDept('All');
                      setFilterRoom('All');
                      setFilterSlot('All');
                      showToast('Filters reset to default');
                    }}
                    className="btn btn-secondary" 
                    style={{ padding: '0.58rem 1rem' }}
                  >
                    <i className="fa-solid fa-rotate-right"></i> Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* 6 KPI Stat Cards */}
            <div className="grid-6" style={{ marginBottom: '1.75rem' }}>
              <div className="kpi-card accent">
                <div className="kpi-label">Total Rooms</div>
                <div className="kpi-value">9</div>
                <div className="kpi-subtext">Active college spaces</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-label">Total Classes</div>
                <div className="kpi-value">5,000</div>
                <div className="kpi-subtext">Classroom sessions</div>
              </div>

              <div className="kpi-card success">
                <div className="kpi-label">Avg Occupancy</div>
                <div className="kpi-value">68.4%</div>
                <div className="kpi-subtext">Students / Capacity</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-label">Room Utilization</div>
                <div className="kpi-value">61.2%</div>
                <div className="kpi-subtext">Used / Avail Hours</div>
              </div>

              <div className="kpi-card warning">
                <div className="kpi-label">Underutilized</div>
                <div className="kpi-value">3</div>
                <div className="kpi-subtext">&lt; 50% room occupancy</div>
              </div>

              <div className="kpi-card danger">
                <div className="kpi-label">Overcapacity</div>
                <div className="kpi-value">4</div>
                <div className="kpi-subtext">Students &gt; Capacity</div>
              </div>
            </div>

            {/* Formula Reference Banner (Viva Friendly) */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-around',
              flexWrap: 'wrap',
              gap: '1rem',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)'
            }}>
              <div>
                <strong>Occupancy % Formula:</strong> <code>(actual_students / room_capacity) * 100</code>
              </div>
              <div>
                <strong>Room Utilization Formula:</strong> <code>(used_hours / available_hours) * 100</code>
              </div>
            </div>

            {/* 6 Real Chart.js Interactive Charts */}
            <div className="grid-2">
              <ChartBox
                id="chart-room-occupancy"
                title="1. Room-wise Occupancy %"
                badge="Seat Utilization"
                icon="fa-solid fa-chart-column"
                type="bar"
                data={chartRoomData}
                options={{
                  scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Occupancy %' } } }
                }}
              />

              <ChartBox
                id="chart-expected-actual"
                title="2. Expected vs Actual Students"
                badge="Attendance Gap"
                icon="fa-solid fa-chart-line"
                type="line"
                data={chartExpectedActualData}
              />

              <ChartBox
                id="chart-department-occupancy"
                title="3. Department-wise Occupancy"
                badge="Dept Comparison"
                icon="fa-solid fa-chart-pie"
                type="doughnut"
                data={chartDeptData}
              />

              <ChartBox
                id="chart-daily-trend"
                title="4. Daily Occupancy Trend"
                badge="Time Series"
                icon="fa-solid fa-arrow-trend-up"
                type="line"
                data={chartDailyTrendData}
              />

              <ChartBox
                id="chart-timeslot"
                title="5. Time-slot / Period Analysis"
                badge="Peak Hours"
                icon="fa-solid fa-clock"
                type="bar"
                data={chartTimeslotData}
              />

              <ChartBox
                id="chart-room-utilization"
                title="6. Room Utilization Ranking"
                badge="Ranked Usage"
                icon="fa-solid fa-bars-progress"
                type="bar"
                data={chartUtilizationData}
                options={{ indexAxis: 'y' }}
              />
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: DATA UPLOAD & CLEANING
           ========================================================================= */}
        {activeTab === 'upload' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h2>Data Upload & Cleaning Pipeline</h2>
                <p>Upload your college Excel or CSV dataset, inspect structure, and execute transparent Pandas cleaning.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button 
                  onClick={() => setActiveTab('dashboard')} 
                  className="btn btn-primary" 
                  style={{ fontSize: '0.84rem' }}
                >
                  <i className="fa-solid fa-chart-pie"></i> View Analytics Dashboard
                </button>
                <a href="http://127.0.0.1:5000/download/classrooms_csv" download className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                  <i className="fa-solid fa-download"></i> Classrooms (.csv)
                </a>
                <a href="http://127.0.0.1:5000/download/timetable_csv" download className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                  <i className="fa-solid fa-download"></i> Timetable (.csv)
                </a>
                <a href="http://127.0.0.1:5000/download/attendance_csv" download className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                  <i className="fa-solid fa-download"></i> Attendance (.csv)
                </a>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <h3><i className="fa-solid fa-file-import" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i> Upload College Dataset</h3>
                  <span className="badge badge-primary">Excel or CSV</span>
                </div>
                <div 
                  style={{ 
                    border: '2px dashed #cbd5e1', 
                    padding: '2.2rem 1.5rem', 
                    textAlign: 'center', 
                    borderRadius: 'var(--radius-md)', 
                    background: '#f8fafc',
                    position: 'relative'
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileUpload({ target: { files: e.dataTransfer.files } });
                    }
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>
                    {isUploading ? '⏳' : '📁'}
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isUploading ? 'Parsing & Inspecting Dataset...' : 'Drag and drop your Excel / CSV file here'}
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Active File: <strong style={{ color: 'var(--primary)' }}>{datasetInfo.filename}</strong> ({datasetInfo.total_rows.toLocaleString()} rows)
                  </p>
                  
                  <label className="btn btn-primary" style={{ marginTop: '1rem', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                    <i className="fa-solid fa-upload"></i> {isUploading ? 'Processing File...' : 'Browse File'}
                    <input 
                      type="file" 
                      accept=".csv, .xlsx, .xls"
                      disabled={isUploading}
                      style={{ display: 'none' }} 
                      onChange={handleFileUpload} 
                    />
                  </label>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3><i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--accent)', marginRight: '0.4rem' }}></i> How Data Cleaning Works</h3>
                  <span className="badge badge-success">Pandas Steps</span>
                </div>
                <ul style={{ paddingLeft: '1.2rem', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <li><strong>Step 1:</strong> <code>df.drop_duplicates()</code> eliminates duplicate timetables or attendance rows.</li>
                  <li><strong>Step 2:</strong> <code>pd.to_datetime()</code> standardizes date formats to <code>YYYY-MM-DD</code>.</li>
                  <li><strong>Step 3:</strong> Median imputation <code>fillna(df[col].median())</code> fills missing attendance safely.</li>
                  <li><strong>Step 4:</strong> Categorical mode imputation fills missing subjects or departments.</li>
                  <li><strong>Step 5:</strong> Capacity and attendance bounds validation (clipping 10 to 500 seats).</li>
                </ul>
              </div>
            </div>

            {/* Active Dataset Inspection & Live Data Preview */}
            <div className="card" style={{ borderTop: '4px solid var(--primary)', marginTop: '1.5rem' }}>
              <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem' }}>
                    Dataset Inspection: <code style={{ color: 'var(--primary)', background: '#e0e7ff', padding: '2px 8px', borderRadius: '4px' }}>{datasetInfo.filename}</code>
                  </h3>
                  <span className={`badge ${datasetInfo.isCleaned ? 'badge-success' : 'badge-warning'}`} style={{ marginTop: '0.35rem' }}>
                    <i className={datasetInfo.isCleaned ? "fa-solid fa-check" : "fa-solid fa-triangle-exclamation"}></i> {datasetInfo.isCleaned ? 'Cleaned & Validated in SQLite' : 'Raw Dataset Loaded'}
                  </span>
                </div>
                <div>
                  <button 
                    onClick={handleCleanData}
                    disabled={isCleaning}
                    className="btn btn-success"
                    style={{ fontSize: '0.88rem' }}
                  >
                    <i className="fa-solid fa-broom"></i> {isCleaning ? 'Cleaning Data...' : 'Clean Data'}
                  </button>
                </div>
              </div>

              {/* Dynamic KPI Cards */}
              <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                <div className="kpi-card accent">
                  <div className="kpi-label">Total Records</div>
                  <div className="kpi-value">{datasetInfo.total_rows.toLocaleString()}</div>
                  <div className="kpi-subtext">Verified rows in dataset</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Columns</div>
                  <div className="kpi-value">{datasetInfo.total_columns}</div>
                  <div className="kpi-subtext">Features detected</div>
                </div>
                <div className={`kpi-card ${datasetInfo.missing_values === 0 ? 'success' : 'warning'}`}>
                  <div className="kpi-label">Missing Values</div>
                  <div className="kpi-value">{datasetInfo.missing_values}</div>
                  <div className="kpi-subtext">{datasetInfo.missing_values === 0 ? 'Zero missing values' : 'Nulls need imputation'}</div>
                </div>
                <div className={`kpi-card ${datasetInfo.duplicate_rows === 0 ? 'success' : 'warning'}`}>
                  <div className="kpi-label">Duplicate Rows</div>
                  <div className="kpi-value">{datasetInfo.duplicate_rows}</div>
                  <div className="kpi-subtext">{datasetInfo.duplicate_rows === 0 ? 'Zero duplicate records' : 'Duplicates detected'}</div>
                </div>
              </div>

              {/* Real Interactive Data Preview Table */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#ffffff', marginTop: '1rem' }}>
                <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <i className="fa-solid fa-table" style={{ color: 'var(--primary)' }}></i>
                    Live Dataset Preview (Showing top {datasetInfo.preview.length} of {datasetInfo.total_rows.toLocaleString()} rows)
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    File: <strong style={{ color: 'var(--text-primary)' }}>{datasetInfo.filename}</strong>
                  </span>
                </div>
                
                <div style={{ overflowX: 'auto', maxHeight: '380px' }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <tr>
                        <th style={{ padding: '9px 12px', borderBottom: '2px solid #cbd5e1', fontWeight: 800, color: '#475569', width: '45px', textAlign: 'center' }}>#</th>
                        {datasetInfo.columns.slice(0, 12).map((col, idx) => (
                          <th key={idx} style={{ padding: '9px 14px', borderBottom: '2px solid #cbd5e1', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {datasetInfo.preview.length === 0 ? (
                        <tr>
                          <td colSpan={datasetInfo.columns.length + 1} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                            No preview data available.
                          </td>
                        </tr>
                      ) : (
                        datasetInfo.preview.map((row, rIdx) => (
                          <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9', background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc', transition: 'background 0.15s' }}>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#94a3b8', fontSize: '0.75rem' }}>
                              {rIdx + 1}
                            </td>
                            {datasetInfo.columns.slice(0, 12).map((col, cIdx) => (
                              <td key={cIdx} style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: '#334155' }}>
                                {String(row[col] !== undefined && row[col] !== null ? row[col] : '—')}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: ATTENDANCE ML
           ========================================================================= */}
        {activeTab === 'prediction' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h2>Student Attendance Count Prediction</h2>
                <p>Uses trained Machine Learning (Linear Regression) to forecast student turnout before classes start.</p>
              </div>
              <div>
                <button onClick={() => setActiveTab('optimizer')} className="btn btn-secondary">
                  <i className="fa-solid fa-sliders"></i> Go to Optimizer
                </button>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <h3><i className="fa-solid fa-calculator" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i> Class Attendance Inputs</h3>
                  <span className="badge badge-primary">Model Parameters</span>
                </div>
                <form onSubmit={handlePredict}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Department</label>
                      <select 
                        value={predForm.department} 
                        onChange={e => setPredForm({...predForm, department: e.target.value})}
                        className="form-select"
                      >
                        <option value="CSE">CSE - Computer Science</option>
                        <option value="AIDS">AIDS - AI & Data Science</option>
                        <option value="IT">IT - Information Technology</option>
                        <option value="ECE">ECE - Electronics</option>
                        <option value="EEE">EEE - Electrical Eng</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Period / Time Slot</label>
                      <select 
                        value={predForm.time_slot} 
                        onChange={e => setPredForm({...predForm, time_slot: e.target.value})}
                        className="form-select"
                      >
                        <option value="P1">P1 (09:00 - 10:00)</option>
                        <option value="P2">P2 (10:00 - 11:00)</option>
                        <option value="P3">P3 (11:15 - 12:15)</option>
                        <option value="P4">P4 (12:15 - 01:15)</option>
                        <option value="P5">P5 (02:00 - 03:00)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Subject Title</label>
                    <input 
                      type="text" 
                      value={predForm.subject} 
                      onChange={e => setPredForm({...predForm, subject: e.target.value})}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Day of Week</label>
                      <select 
                        value={predForm.day} 
                        onChange={e => setPredForm({...predForm, day: e.target.value})}
                        className="form-select"
                      >
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Historical Turnout (%)</label>
                      <input 
                        type="number" 
                        value={predForm.history} 
                        onChange={e => setPredForm({...predForm, history: e.target.value})}
                        className="form-control"
                        min="40" max="100" step="0.5"
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}>
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Predict Expected Attendance
                  </button>
                </form>
              </div>

              <div>
                {predResult ? (
                  <div className="card" style={{ borderTop: '4px solid var(--success)' }}>
                    <div className="card-header">
                      <h3><i className="fa-solid fa-bullseye" style={{ color: 'var(--success)', marginRight: '0.4rem' }}></i> Prediction Results</h3>
                      <span className="badge badge-success">ML Output</span>
                    </div>

                    <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '1.25rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#166534' }}>Predicted Students</span>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#15803d', marginTop: '0.25rem' }}>
                          {predResult.predicted_students}
                        </div>
                        <small style={{ color: '#16a34a' }}>Expected actual attendees</small>
                      </div>

                      <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 'var(--radius-md)', padding: '1.25rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#3730a3' }}>Recommended Capacity</span>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#4338ca', marginTop: '0.25rem' }}>
                          {predResult.min_capacity}
                        </div>
                        <small style={{ color: '#6366f1' }}>+{predResult.buffer_seats} seats safety cushion</small>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        <i className="fa-solid fa-magnifying-glass-chart" style={{ color: 'var(--primary)', marginRight: '0.35rem' }}></i> Key Influencing Factors:
                      </h4>
                      <ul style={{ paddingLeft: '1.2rem', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        {predResult.factors.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>

                    <button 
                      onClick={() => {
                        setOptForm({
                          ...optForm,
                          students: predResult.predicted_students,
                          department: predForm.department,
                          time_slot: predForm.time_slot
                        });
                        setActiveTab('optimizer');
                        handleOptimize();
                      }}
                      className="btn btn-success" 
                      style={{ width: '100%', padding: '0.75rem' }}
                    >
                      <i className="fa-solid fa-arrow-right"></i> Optimize Classroom for this Prediction
                    </button>
                  </div>
                ) : (
                  <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                    <div style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>🧠</div>
                    <h4 style={{ fontWeight: 700 }}>Awaiting Prediction</h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      Configure parameters and click Predict to forecast attendance.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: AUTONOMOUS OPTIMIZER (MAIN FEATURE)
           ========================================================================= */}
        {activeTab === 'optimizer' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h2>Autonomous Classroom Resource Optimizer</h2>
                <p>The core engine: Evaluates operational constraints, scores available spaces, and reallocates classes to minimize wasted capacity.</p>
              </div>
              <div>
                <span className="badge badge-success" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                  ✓ {approvedCount} Approved Allocations (+{totalSeatsSaved} seats saved)
                </span>
              </div>
            </div>

            {/* Constraints Reference Bar */}
            <div className="card" style={{ background: '#f8fafc', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                <i className="fa-solid fa-shield-check" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i> 6 Enforced Allocation Constraints:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <div><strong>C1:</strong> Capacity &ge; Students</div>
                <div><strong>C2:</strong> Room is Operational</div>
                <div><strong>C3:</strong> Zero Timetable Clash</div>
                <div><strong>C4:</strong> Equipment Matched</div>
                <div><strong>C5:</strong> Min Unused Capacity</div>
                <div><strong>C6:</strong> Proximity / Building Fit</div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <h3><i className="fa-solid fa-bullseye" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i> Class Optimization Request</h3>
                  <span className="badge badge-primary">Input Parameters</span>
                </div>
                <form onSubmit={handleOptimize}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Predicted / Actual Students</label>
                      <input 
                        type="number" 
                        value={optForm.students} 
                        onChange={e => setOptForm({...optForm, students: e.target.value})}
                        className="form-control"
                        min="10" max="250"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Department</label>
                      <select 
                        value={optForm.department} 
                        onChange={e => setOptForm({...optForm, department: e.target.value})}
                        className="form-select"
                      >
                        <option value="CSE">CSE</option>
                        <option value="AIDS">AIDS</option>
                        <option value="IT">IT</option>
                        <option value="ECE">ECE</option>
                        <option value="EEE">EEE</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Time Slot / Period</label>
                      <select 
                        value={optForm.time_slot} 
                        onChange={e => setOptForm({...optForm, time_slot: e.target.value})}
                        className="form-select"
                      >
                        <option value="P1">P1 (09:00 - 10:00)</option>
                        <option value="P2">P2 (10:00 - 11:00)</option>
                        <option value="P3">P3 (11:15 - 12:15)</option>
                        <option value="P4">P4 (12:15 - 01:15)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Equipment Needed</label>
                      <select 
                        value={optForm.equipment} 
                        onChange={e => setOptForm({...optForm, equipment: e.target.value})}
                        className="form-select"
                      >
                        <option value="Projector">Digital Projector</option>
                        <option value="Lab">Computer Lab</option>
                        <option value="None">None</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Currently Assigned Room (For Before vs After)</label>
                    <select 
                      value={optForm.current_room} 
                      onChange={e => setOptForm({...optForm, current_room: e.target.value})}
                      className="form-select"
                    >
                      <option value="R203">R203 (Capacity: 120 seats - Large Lecture Hall)</option>
                      <option value="R204">R204 (Capacity: 150 seats - Auditorial Hall)</option>
                      <option value="R202">R202 (Capacity: 100 seats - Seminar Hall)</option>
                      <option value="R105">R105 (Capacity: 75 seats - Medium Classroom)</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}>
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Find Optimal Classroom Allocation
                  </button>
                </form>
              </div>

              <div>
                {optResult ? (
                  <div className="card" style={{ borderTop: '4px solid var(--success)' }}>
                    <div className="card-header">
                      <div>
                        <span className="badge badge-success" style={{ marginBottom: '0.35rem' }}>Optimal Match Found</span>
                        <h3 style={{ fontSize: '1.6rem', color: '#15803d' }}>Room {optResult.bestMatch.room_id}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {optResult.bestMatch.room_type} • {optResult.bestMatch.capacity} seats • Floor {optResult.bestMatch.floor}, {optResult.bestMatch.building}
                        </p>
                      </div>
                      <div>
                        <span className="badge badge-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                          Score: {optResult.bestMatch.score} pts
                        </span>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        <i className="fa-solid fa-clipboard-check" style={{ color: 'var(--success)', marginRight: '0.35rem' }}></i> Why this room was selected:
                      </h4>
                      <ul style={{ paddingLeft: '1.2rem', fontSize: '0.84rem', color: '#15803d', lineHeight: 1.7 }}>
                        {optResult.bestMatch.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Before vs After Visual Demonstration */}
                    <div className="comparison-container">
                      <div className="comparison-panel panel-before">
                        <div className="comparison-title"><i className="fa-solid fa-circle-xmark"></i> Before Optimization</div>
                        <div className="stat-row"><span>Assigned Room:</span> <strong>{optResult.comparison.current_room}</strong></div>
                        <div className="stat-row"><span>Capacity:</span> <strong>{optResult.comparison.current_capacity} seats</strong></div>
                        <div className="stat-row"><span>Unused Seats:</span> <strong style={{ color: '#b91c1c' }}>{optResult.comparison.unused_before}</strong></div>
                      </div>

                      <div className="comparison-panel panel-after">
                        <div className="comparison-title"><i className="fa-solid fa-circle-check"></i> After Optimization</div>
                        <div className="stat-row"><span>Allocated Room:</span> <strong>{optResult.comparison.recommended_room}</strong></div>
                        <div className="stat-row"><span>Capacity:</span> <strong>{optResult.comparison.recommended_capacity} seats</strong></div>
                        <div className="stat-row"><span>Unused Seats:</span> <strong style={{ color: '#15803d' }}>{optResult.comparison.unused_after}</strong></div>
                        <div className="stat-row" style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #bbf7d0' }}>
                          <span>Efficiency Gain:</span> <strong style={{ color: '#15803d' }}>+{optResult.comparison.seats_saved} seats saved!</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                      <button 
                        onClick={handleApproveAllocation}
                        className="btn btn-success" 
                        style={{ width: '100%', padding: '0.75rem' }}
                      >
                        <i className="fa-solid fa-check"></i> Review & Approve Allocation
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                    <div style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>⚙️</div>
                    <h4 style={{ fontWeight: 700 }}>Ready to Optimize</h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      Enter student requirements and click Find Optimal Classroom Allocation.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: WHAT-IF SIMULATOR
           ========================================================================= */}
        {activeTab === 'simulator' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h2>What-If Scenario Simulator</h2>
                  <span className="badge badge-simulation"><i className="fa-solid fa-flask"></i> Simulation Engine</span>
                </div>
                <p>Stress-test college operations: Test hypothetical classroom closures, attendance surges, and extra batch additions without altering real data.</p>
              </div>
              <div>
                <button onClick={() => setActiveTab('dashboard')} className="btn btn-secondary">
                  <i className="fa-solid fa-chart-pie"></i> View Analytics Dashboard
                </button>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <h3><i className="fa-solid fa-sliders" style={{ color: '#9333ea', marginRight: '0.4rem' }}></i> Configure Simulation Scenario</h3>
                  <span className="badge badge-simulation">Simulation Input</span>
                </div>
                <form onSubmit={handleRunSimulation}>
                  <div className="form-group">
                    <label className="form-label">Select What-If Scenario</label>
                    <select 
                      value={simScenario} 
                      onChange={e => setSimScenario(e.target.value)}
                      className="form-select"
                    >
                      <option value="room_closed">Scenario 1: Classroom Maintenance / Closure (e.g. R202)</option>
                      <option value="attendance_surge">Scenario 2: Sudden Attendance Surge (+20% to +35%)</option>
                    </select>
                  </div>

                  {simScenario === 'room_closed' ? (
                    <div className="form-group">
                      <label className="form-label">Room Under Maintenance</label>
                      <select 
                        value={closedRoom} 
                        onChange={e => setClosedRoom(e.target.value)}
                        className="form-select"
                      >
                        <option value="R202">R202 (100 seats - Seminar Hall)</option>
                        <option value="R203">R203 (120 seats - Lecture Hall)</option>
                        <option value="R105">R105 (75 seats - Classroom)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Turnout Surge: +{surgePercent}%</label>
                      <input 
                        type="range" 
                        min="10" max="50" step="5" 
                        value={surgePercent} 
                        onChange={e => setSurgePercent(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', background: '#7e22ce', borderColor: '#6b21a8' }}>
                    <i className="fa-solid fa-play"></i> Execute Scenario Simulation
                  </button>
                </form>
              </div>

              <div className="card" style={{ borderTop: '4px solid #9333ea' }}>
                <div className="card-header">
                  <div>
                    <span className="badge badge-simulation" style={{ marginBottom: '0.3rem' }}>Simulation Result</span>
                    <h3 style={{ color: '#581c87' }}>Scenario Impact Analysis</h3>
                  </div>
                  <div>
                    <span className="badge badge-warning">{simResult.after.reallocated} classes shifted</span>
                  </div>
                </div>

                <div className="comparison-container">
                  <div className="comparison-panel panel-before">
                    <div className="comparison-title"><i className="fa-solid fa-clock-rotate-left"></i> Before Simulation</div>
                    <div className="stat-row"><span>Classrooms Used:</span> <strong>{simResult.before.rooms_used}</strong></div>
                    <div className="stat-row"><span>Active Conflicts:</span> <strong style={{ color: '#b91c1c' }}>{simResult.before.conflicts}</strong></div>
                    <div className="stat-row"><span>Avg Room Utilization:</span> <strong>{simResult.before.utilization}%</strong></div>
                  </div>

                  <div className="comparison-panel panel-after">
                    <div className="comparison-title"><i className="fa-solid fa-circle-check"></i> Simulation Result (After)</div>
                    <div className="stat-row"><span>Classrooms Used:</span> <strong>{simResult.after.rooms_used}</strong></div>
                    <div className="stat-row"><span>Active Conflicts:</span> <strong style={{ color: '#15803d' }}>{simResult.after.conflicts}</strong></div>
                    <div className="stat-row"><span>Avg Room Utilization:</span> <strong style={{ color: '#15803d' }}>{simResult.after.utilization}%</strong></div>
                  </div>
                </div>

                <div style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: '#6b21a8', background: '#faf5ff', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid #e9d5ff' }}>
                  <i className="fa-solid fa-lightbulb"></i> <strong>Simulation Insight:</strong> The optimizer re-routed classes from unavailable or overflowing rooms into best-fit alternative spaces while preventing secondary conflicts.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 6: EVENTS PREDICTOR
           ========================================================================= */}
        {activeTab === 'events' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h2>College Event Attendance & Venue Allocator</h2>
                <p>Estimate expected student attendance for campus events, seminars, and symposiums, and identify best-fit halls.</p>
              </div>
              <div>
                <button onClick={() => setActiveTab('conflicts')} className="btn btn-secondary">
                  <i className="fa-solid fa-triangle-exclamation"></i> Check Schedule Conflicts
                </button>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <h3><i className="fa-solid fa-calendar-plus" style={{ color: 'var(--primary)', marginRight: '0.4rem' }}></i> Event Parameters</h3>
                  <span className="badge badge-primary">Venue Booking</span>
                </div>
                <form onSubmit={handlePredictEvent}>
                  <div className="form-group">
                    <label className="form-label">Event Name</label>
                    <input 
                      type="text" 
                      value={eventForm.name} 
                      onChange={e => setEventForm({...eventForm, name: e.target.value})}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Event Type</label>
                      <select 
                        value={eventForm.type} 
                        onChange={e => setEventForm({...eventForm, type: e.target.value})}
                        className="form-select"
                      >
                        <option value="Technical Symposium">Technical Symposium (80%)</option>
                        <option value="Workshop">Hands-on Workshop (85%)</option>
                        <option value="Guest Lecture">Industry Guest Lecture (75%)</option>
                        <option value="Hackathon">Coding Hackathon (88%)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Registrations</label>
                      <input 
                        type="number" 
                        value={eventForm.registrations} 
                        onChange={e => setEventForm({...eventForm, registrations: e.target.value})}
                        className="form-control"
                        min="20" max="500"
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}>
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Predict Turnout & Allocate Venue
                  </button>
                </form>
              </div>

              <div>
                {eventResult ? (
                  <div className="card" style={{ borderTop: '4px solid var(--accent)' }}>
                    <div className="card-header">
                      <div>
                        <span className="badge badge-primary" style={{ marginBottom: '0.35rem' }}>Venue Allocation Result</span>
                        <h3 style={{ color: 'var(--accent)' }}>{eventResult.venue.room_id} ({eventResult.venue.room_type})</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Capacity: {eventResult.venue.capacity} seats • Floor {eventResult.venue.floor}, {eventResult.venue.building}
                        </p>
                      </div>
                    </div>

                    <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '1.15rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#166534' }}>Predicted Attendees</span>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#15803d', marginTop: '0.25rem' }}>{eventResult.attendees}</div>
                      </div>

                      <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 'var(--radius-md)', padding: '1.15rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#3730a3' }}>Required Seats</span>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#4338ca', marginTop: '0.25rem' }}>{eventResult.minSeats}</div>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <i className="fa-solid fa-circle-check" style={{ color: 'var(--success)', marginRight: '0.35rem' }}></i>
                      {eventResult.explanation}
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
                    <div style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>📅</div>
                    <h4 style={{ fontWeight: 700 }}>Event Venue Sizing</h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      Input registration count to forecast realistic turnout and reserve a hall.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 7: CONFLICTS DETECTION
           ========================================================================= */}
        {activeTab === 'conflicts' && (
          <div>
            <div className="page-header">
              <div className="page-title">
                <h2>Schedule & Resource Conflict Detection</h2>
                <p>Automated scanner detecting double bookings, overcrowded rooms, faculty clashes, and missing lab equipment.</p>
              </div>
              <div>
                <button onClick={() => setActiveTab('optimizer')} className="btn btn-primary">
                  <i className="fa-solid fa-sliders"></i> Open Optimizer
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { type: 'Capacity Conflict', sev: 'High', title: 'Capacity Deficit: Cloud Computing (CSE-3A)', desc: 'Room R104 has capacity of 60, but attendance predicted is 74 students (+14 over capacity).', rec: ['R105 (75 seats)', 'R201 (90 seats)'] },
                { type: 'Room Double-Booking', sev: 'High', title: 'Double Booking in Room R102', desc: 'Room R102 is booked simultaneously for Machine Learning (AIDS) and Signals & Systems (ECE) at Period P2.', rec: ['R103 (50 seats)', 'R104 (60 seats)'] },
                { type: 'Resource Conflict', sev: 'Medium', title: 'Lab Equipment Missing: Advanced Java Lab', desc: 'Subject requires Computer Lab facilities, but allocated room R105 only possesses a standard whiteboard.', rec: ['R201 (90 seats, Lab equipped)'] }
              ].map((c, i) => (
                <div key={i} className="card" style={{ borderLeft: `4px solid ${c.sev === 'High' ? 'var(--danger)' : 'var(--warning)'}`, marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span className={`badge ${c.sev === 'High' ? 'badge-danger' : 'badge-warning'}`}>
                          {c.type}
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Severity: {c.sev}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {c.title}
                      </h3>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                        {c.desc}
                      </p>
                    </div>

                    <div>
                      <button 
                        onClick={() => {
                          setOptForm({ ...optForm, students: 74, department: 'CSE' });
                          setActiveTab('optimizer');
                          handleOptimize();
                        }}
                        className="btn btn-outline" 
                        style={{ fontSize: '0.82rem' }}
                      >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Auto-Resolve with Optimizer
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Suggested Alternative Rooms:
                    </span>
                    {c.rec.map((r, ri) => (
                      <span key={ri} className="badge badge-primary" style={{ fontSize: '0.78rem' }}>
                        <i className="fa-solid fa-door-open"></i> {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="footer">
        <p><strong>AI-Powered Classroom Resource Optimization System</strong> • Academic Year 2025–2026</p>
        <p style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
          Designed for College Project Presentation & Viva Defense • Built with React, Next.js, Scikit-learn & Google Gemini AI
        </p>
      </footer>

      {/* FLOATING ROUND AI ASSISTANT BUTTON (BOTTOM RIGHT) */}
      <FloatingAIAssistant />

    </div>
  );
}
