'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function FloatingAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [activeModel, setActiveModel] = useState(null);
  const [testStatus, setTestStatus] = useState(null); // { type: 'success' | 'error' | 'loading', msg: '' }
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "👋 Hello! I am your AI Campus Resource Copilot.\n\nAsk me anything about classroom allocations, timetable conflicts, capacity optimization, ML prediction, formulas, or viva defense questions!\n\nYou can also click any quick topic below for an instant answer.",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load API key strictly from local browser storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('smartoccupy_gemini_key');
      if (savedKey) {
        setApiKey(savedKey);
        setKeySaved(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Test the key actively via our Next.js backend endpoint
  const handleTestKey = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setTestStatus({ type: 'error', msg: 'Please enter an API key first.' });
      return;
    }
    setTestStatus({ type: 'loading', msg: 'Connecting to Google Gemini API...' });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Hello, confirm you are connected in 5 words.',
          apiKey: cleanKey,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setActiveModel(data.model || 'Gemini 2.0 Flash');
        setTestStatus({
          type: 'success',
          msg: `Connected successfully! Active model: ${data.model || 'Gemini'}. AI responses are live!`,
        });
      } else {
        const errMsg = data.error || 'Could not connect. Please check your API key.';
        setTestStatus({
          type: 'error',
          msg: `Error: ${errMsg}. Note: Keys generated from Google AI Studio (aistudio.google.com/app/apikey) work automatically.`,
        });
      }
    } catch (err) {
      setTestStatus({ type: 'error', msg: `Network error: ${err.message}` });
    }
  };

  // Save key ONLY in local storage
  const handleSaveKey = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) return;
    localStorage.setItem('smartoccupy_gemini_key', cleanKey);
    setKeySaved(true);
    setTestStatus(null);
    setShowKeyInput(false);

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: `✅ Google Gemini API key saved strictly in your local browser storage!\n\nYou now have live interactive AI responses powered directly by Google Gemini.`,
      },
    ]);
  };

  // Immediate purge of API key from local storage
  const handleDeleteKey = () => {
    localStorage.removeItem('smartoccupy_gemini_key');
    setApiKey('');
    setKeySaved(false);
    setActiveModel(null);
    setTestStatus(null);
    setShowKeyInput(false);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: '🗑️ Your Gemini API key has been deleted from your local browser storage.\nThe assistant will now operate in offline smart knowledge mode.',
      },
    ]);
  };

  // Comprehensive Offline Smart Knowledge Copilot Engine
  const generateOfflineResponse = (query) => {
    const q = query.toLowerCase();

    // Project overview and purpose
    if (
      q.includes('what do this project') ||
      q.includes('what does this project') ||
      q.includes('what is this project') ||
      q.includes('about this project') ||
      q.includes('overview') ||
      q.includes('purpose') ||
      q.includes('projecrt') ||
      q.includes('project do')
    ) {
      return `🏫 **SmartOccupy AI — College Classroom Resource Optimization System**

**SmartOccupy AI** is an intelligent academic resource optimizer engineered to solve real-world campus scheduling, overcrowding, and classroom capacity bottlenecks.

### 🌟 5 Core Pillars of This Project:
1. **Attendance Prediction ML Engine**:
   Analyzes 5,000 real class sessions across 5 engineering departments (CSE, AIDS, IT, ECE, EEE). Multiple Linear Regression achieves a Mean Absolute Error (MAE) of **~5.3 students**.

2. **Autonomous Room Allocation Optimizer**:
   Evaluates classrooms (R101 – R204) across **6 operational constraints** (+40 capacity, +30 availability, +20 no clashes, +15 equipment, +20 tightest fit bonus, +10 proximity) to score and pick the optimal room.

3. **Overcrowding & Safety Cushion**:
   Applies an automated **+10% capacity buffer** to accommodate attendance walk-ins and student surges without seat deficits.

4. **Energy & Campus Power Conservation**:
   Eliminates assigning small 35-student batches into 150-seat lecture halls, cutting wasted cooling, lighting, and unused capacity by **28%**.

5. **Conflict & Schedule Shield**:
   Scans timetables for capacity deficits, double-bookings, and missing lab equipment with one-click resolution.`;
    }

    if (q.includes('formula') || q.includes('calculate') || q.includes('occupancy') || q.includes('utilization')) {
      return `📐 Key Resource Optimization Formulas:

1. **Classroom Occupancy Rate (%)**:
   \`Occupancy = (Actual Student Attendance / Room Capacity) * 100\`
   • Ideal Range: 70% – 85%
   • Underutilized: < 50% (wastes cooling, lighting & space)
   • Overcrowded: > 100% (critical capacity deficit)

2. **Room Utilization Rate (%)**:
   \`Utilization = (Total Hours Used Per Week / Total Operating Hours Available) * 100\`
   • 40-hour college operational week (8 AM – 4 PM, Mon–Fri).

3. **Dynamic Capacity Safety Buffer**:
   \`Buffer Capacity = Predicted Attendance + 10%\`
   • Accommodates attendance surges and late walk-ins without overcrowding.

4. **Wasted Capacity Index**:
   \`Wasted Seats = Room Capacity - Actual Attendance\``;
    }

    if (q.includes('score') || q.includes('scoring') || q.includes('algorithm') || q.includes('constraint')) {
      return `⚙️ Autonomous Multi-Constraint Scoring Algorithm:

The optimizer evaluates candidate rooms using a weighted 135-point scoring engine:

1. **Capacity Adequacy (+40 pts)**:
   Room capacity must be ≥ (predicted attendance + 10% safety buffer).

2. **Schedule Availability (+30 pts)**:
   Room is currently unallocated during the requested day and timeslot.

3. **Zero Timetable Conflict (+20 pts)**:
   Strict verification preventing double-booking across all 5 departments.

4. **Lab & Equipment Match (+15 pts)**:
   Sessions flagged as practicals require projector, workstations, or audio systems.

5. **Tightest Fit Bonus (Up to +20 pts)**:
   \`Bonus = max(0, 20 - (Room Capacity - Needed Capacity))\`
   Penalizes assigning a 45-student class to a 150-seat auditorium.

6. **Department Proximity (+10 pts)**:
   Bonus for rooms located in the student batch's home building wing.`;
    }

    if (q.includes('viva') || q.includes('exam') || q.includes('defense') || q.includes('presentation') || q.includes('why linear')) {
      return `🎓 Top 5 Viva Questions & High-Scoring Answers:

**Q1: Why choose Linear Regression over Deep Learning (LSTM / Transformers)?**
*Answer:* Tabular attendance data (5,000 rows) is structured and linear. Linear Regression trains in milliseconds, is 100% mathematically interpretable (weights can be explained to examiners), avoids overfitting, and achieves a strong MAE of ~5.3 students without requiring GPU resources.

**Q2: How does the optimizer prevent timetable clashes?**
*Answer:* It maintains a composite key constraint \`(room_id, day_of_week, time_slot)\`. Before allocating any room, it queries both scheduled regular classes and one-off campus events to ensure zero overlap.

**Q3: How do you handle capacity buffer?**
*Answer:* We apply a \`+10% safety cushion\` over predicted attendance. If ML predicts 54 students, we search for rooms with capacity ≥ 60 seats to eliminate overcrowding.

**Q4: What data features are most predictive of attendance?**
*Answer:* Class size (highest correlation), Day of week (Fridays lower, mid-week higher), and Time slot (early morning / late afternoon attendance dips).

**Q5: What are the business and environmental benefits?**
*Answer:* Reallocating classes to right-sized halls cuts unused seat space by 28% and saves significant campus electricity (HVAC cooling and lighting).`;
    }

    if (q.includes('model') || q.includes('ml') || q.includes('machine learning') || q.includes('mae') || q.includes('r2')) {
      return `🤖 Machine Learning Pipeline & Metrics:

- **Target Variable**: \`actual_attendance\` (integer count of students attending)
- **Features Used**: \`class_size\`, \`day_of_week\`, \`time_slot\`, \`department\`, \`room_capacity\`
- **Train/Test Split**: 80% Training (4,000 sessions), 20% Testing (1,000 sessions)
- **Primary Model**: Multiple Linear Regression
  • Mean Absolute Error (MAE): ~5.32 students
  • R² Score: ~0.84
- **Secondary Model**: Random Forest Regressor (50 estimators)
  • Used to capture non-linear department and time-slot interactions.
- **Safety Cushion**: +10% capacity buffer dynamically applied to all predictions.`;
    }

    if (q.includes('conflict') || q.includes('clash') || q.includes('double') || q.includes('deficit')) {
      return `⚠️ Conflict Detection Engine:

The system scans 3 distinct operational bottlenecks:
1. **Capacity Deficits**: When student enrollment exceeds the allocated room capacity (e.g. 75 students packed into a 50-seat room).
2. **Double Bookings**: Two courses scheduled in the same room at the same day/hour.
3. **Equipment Mismatch**: Lab/projector courses scheduled in standard classrooms lacking necessary equipment.

Click the **Conflicts** tab in the top navigation to view the active scanned list with one-click resolution recommendations!`;
    }

    if (q.includes('dataset') || q.includes('data') || q.includes('5000') || q.includes('sessions')) {
      return `📊 Dataset Architecture:

- **Total Records**: 5,000 collegiate class sessions
- **Departments**: CSE (Computer Science), AIDS (AI & Data Science), IT, ECE (Electronics), EEE (Electrical)
- **Classroom Pool**:
  • Small Halls: R101 (30), R102 (40), R103 (50)
  • Medium Halls: R104 (60), R105 (75)
  • Specialized / Large: R201 (90, Lab), R202 (100, Seminar), R203 (120, Lecture), R204 (150, Grand Auditorium)
- **Storage**: SQLite Database (\`classroom_optimizer.db\`) with clean normalization.`;
    }

    return `💡 **SmartOccupy Copilot Analysis**:
Regarding "${query}":

Our system continuously balances three competing campus priorities:
1. **Student Comfort**: Ensuring zero overcrowding with an automated +10% safety seat buffer.
2. **Space Efficiency**: Avoiding assigning 40-student batches to 120-seat lecture halls.
3. **Operational Stability**: Eliminating double-bookings and laboratory equipment mismatches across CSE, AIDS, IT, ECE, and EEE.

*Tip: You can use the quick chips below or type "Formulas", "Scoring Rules", or "Viva Questions" for immediate deep-dives!*`;
  };

  // Main Prompt Execution (Invoked by both form submission and chip clicks)
  const sendPrompt = async (textToSend) => {
    const userText = (textToSend || inputValue || '').trim();
    if (!userText || isLoading) return;

    setInputValue('');

    // Check if the user accidentally pasted a Google Gemini API Key into the chat input
    if (
      (userText.startsWith('AIzaSy') || (userText.length >= 35 && !userText.includes(' '))) &&
      !userText.includes('\n')
    ) {
      localStorage.setItem('smartoccupy_gemini_key', userText);
      setApiKey(userText);
      setKeySaved(true);
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: '🔑 [Pasted Gemini API Key]' },
        {
          role: 'assistant',
          text: '🔑 **Detected Gemini API Key!**\nI have saved your key strictly in your browser local storage (`localStorage`). Connecting now...',
        },
      ]);
      return;
    }

    // Add user message to state
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    const cleanKey = apiKey.trim();

    // If API Key is present, call our server-side /api/chat endpoint
    if (keySaved && cleanKey) {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userText,
            apiKey: cleanKey,
          }),
        });

        const data = await res.json();

        if (data.success && data.answer) {
          setActiveModel(data.model || 'Gemini');
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: data.answer,
              badge: `Gemini AI (${data.model || 'Live'})`,
            },
          ]);
        } else {
          // If Gemini API gave an error, inform the user cleanly and display Copilot answer
          const offlineReply = generateOfflineResponse(userText);
          const errDetail = data.error || 'Gemini service unreachable';
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: `⚠️ **Gemini Notice**: ${errDetail}\n*(Note: For instant live responses, generate a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey))*\n\n🤖 **SmartOccupy Copilot (Knowledge Engine)**:\n${offlineReply}`,
            },
          ]);
        }
      } catch (networkErr) {
        const offlineReply = generateOfflineResponse(userText);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `⚠️ **Network Notice**: ${networkErr.message}\n\n🤖 **SmartOccupy Copilot (Knowledge Engine)**:\n${offlineReply}`,
          },
        ]);
      }
    } else {
      // Local Smart Heuristics Fallback when no key is set
      setTimeout(() => {
        const offlineReply = generateOfflineResponse(userText);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: offlineReply,
          },
        ]);
      }, 300);
    }

    setIsLoading(false);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    sendPrompt(inputValue);
  };

  return (
    <>
      {/* Floating Round Action Button (FAB) at Bottom Right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fab-ai-btn"
        title="Open AI Resource Assistant"
        aria-label="Open AI Resource Assistant"
        id="fab-ai-toggle"
      >
        <span className="fab-pulse" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      </button>

      {/* Pop-up AI Assistant Drawer */}
      {isOpen && (
        <div className="ai-modal-drawer" id="ai-assistant-drawer">
          {/* Header */}
          <div className="ai-drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="ai-drawer-avatar">AI</div>
              <div>
                <h4 className="ai-drawer-title">Campus Resource Copilot</h4>
                <p className="ai-drawer-subtitle">
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#10b981',
                      display: 'inline-block',
                    }}
                  />
                  {keySaved
                    ? activeModel
                      ? `${activeModel} Active`
                      : 'Gemini AI Active'
                    : 'Smart Knowledge Mode'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="ai-header-btn"
                title="Manage Gemini API Key"
              >
                <span>🔑</span> Key
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="ai-close-btn"
                title="Close Assistant"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Gemini API Key Management Modal / Dropdown */}
          {showKeyInput && (
            <div className="ai-key-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: '#1e3a8a' }}>
                  🔒 Google Gemini API Key (Strictly Local)
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Get Free Key ↗
                </a>
              </div>
              <p style={{ color: '#64748b', marginBottom: '8px', lineHeight: 1.4 }}>
                Stored <strong>only in browser localStorage</strong>. Generates live answers via Google Gemini 2.0 / 2.5 Flash.
              </p>

              <div className="ai-key-input-row">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste Gemini API Key (AIzaSy...)"
                  className="ai-key-input"
                />
                <button onClick={handleSaveKey} className="ai-key-save-btn">
                  Save
                </button>
              </div>

              {/* Status or test banner */}
              {testStatus && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    lineHeight: 1.4,
                    background:
                      testStatus.type === 'success'
                        ? '#d1fae5'
                        : testStatus.type === 'loading'
                        ? '#fef3c7'
                        : '#fee2e2',
                    color:
                      testStatus.type === 'success'
                        ? '#065f46'
                        : testStatus.type === 'loading'
                        ? '#92400e'
                        : '#991b1b',
                    border: `1px solid ${
                      testStatus.type === 'success'
                        ? '#6ee7b7'
                        : testStatus.type === 'loading'
                        ? '#fde68a'
                        : '#fca5a5'
                    }`,
                  }}
                >
                  {testStatus.msg}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #dbeafe' }}>
                <button
                  onClick={handleTestKey}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    fontSize: '11px',
                  }}
                >
                  ⚡ Test Connection
                </button>
                {keySaved && (
                  <button onClick={handleDeleteKey} className="ai-key-delete-btn">
                    🗑️ Delete Key From Browser
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chat Messages Area */}
          <div className="ai-chat-body">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={m.role === 'user' ? 'ai-msg-row-user' : 'ai-msg-row-assistant'}
              >
                <div
                  className={
                    m.role === 'user' ? 'ai-msg-bubble-user' : 'ai-msg-bubble-assistant'
                  }
                >
                  {m.badge && (
                    <div className="ai-badge">
                      <span>✨</span> {m.badge}
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-msg-row-assistant">
                <div
                  className="ai-msg-bubble-assistant"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}
                >
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid #4f46e5',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>Generating intelligent answer...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Preset Quick Chips - Click directly sends the question! */}
          <div className="ai-chips-bar">
            <button
              onClick={() => sendPrompt('What does this project do?')}
              className="ai-chip-btn"
              title="Click to ask What this project does"
            >
              🏫 Project Overview
            </button>
            <button
              onClick={() => sendPrompt('How does the multi-constraint scoring algorithm work?')}
              className="ai-chip-btn"
              title="Click to ask about Scoring Rules"
            >
              ⚙️ Scoring Rules
            </button>
            <button
              onClick={() => sendPrompt('Explain occupancy vs utilization formulas')}
              className="ai-chip-btn"
              title="Click to ask about Formulas"
            >
              📐 Formulas
            </button>
            <button
              onClick={() => sendPrompt('Give me 5 common viva questions and answers for this project')}
              className="ai-chip-btn"
              title="Click to ask Viva Questions"
            >
              🎓 Viva Questions
            </button>
            <button
              onClick={() => sendPrompt('Why choose Linear Regression over Deep Learning for this project?')}
              className="ai-chip-btn"
              title="Click to ask Why Linear Regression"
            >
              🤖 Why Linear Regression?
            </button>
          </div>

          {/* Input Box */}
          <form onSubmit={handleFormSubmit} className="ai-input-form">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                keySaved
                  ? 'Ask Gemini anything about this project...'
                  : 'Ask Copilot (or enter API key)...'
              }
              className="ai-chat-input"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="ai-send-btn"
            >
              Send ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
