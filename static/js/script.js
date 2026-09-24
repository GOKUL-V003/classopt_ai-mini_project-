/**
 * script.js - Client-Side Interactive Logic for Classroom Resource Optimizer
 * Connects UI elements to Flask APIs and manages Chart.js visualizations cleanly.
 */

// Global storage for Chart.js instances so they can be destroyed and updated cleanly
window.appCharts = {};

function initChart(canvasId, type, data, options) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    if (window.appCharts[canvasId]) {
        window.appCharts[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: type,
        data: data,
        options: Object.assign({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: 'Plus Jakarta Sans', size: 12 } }
                }
            }
        }, options || {})
    });

    window.appCharts[canvasId] = chart;
    return chart;
}

// ==============================================================================
// DASHBOARD LOGIC (PAGE 4)
// ==============================================================================
function loadDashboardData() {
    const dept = document.getElementById('filter-dept')?.value || 'All';
    const room = document.getElementById('filter-room')?.value || 'All';
    const slot = document.getElementById('filter-slot')?.value || 'All';

    const url = `/api/dashboard-data?department=${encodeURIComponent(dept)}&room_id=${encodeURIComponent(room)}&time_slot=${encodeURIComponent(slot)}`;

    fetch(url)
        .then(res => res.json())
        .then(payload => {
            const kpis = payload.kpis;
            const charts = payload.charts;

            // 1. Update KPI Cards
            if (document.getElementById('kpi-total-rooms')) {
                document.getElementById('kpi-total-rooms').innerText = kpis.total_classrooms;
                document.getElementById('kpi-total-classes').innerText = kpis.total_classes;
                document.getElementById('kpi-avg-occupancy').innerText = kpis.avg_occupancy + '%';
                document.getElementById('kpi-avg-utilization').innerText = kpis.avg_utilization + '%';
                document.getElementById('kpi-underutilized').innerText = kpis.underutilized_rooms;
                document.getElementById('kpi-overcapacity').innerText = kpis.overcapacity_classes;
            }

            // 2. Render Chart 1: Room Occupancy %
            if (charts.room_occupancy) {
                initChart('chart-room-occupancy', 'bar', {
                    labels: charts.room_occupancy.labels,
                    datasets: [{
                        label: 'Average Occupancy %',
                        data: charts.room_occupancy.data,
                        backgroundColor: '#6366f1',
                        borderRadius: 6
                    }]
                }, {
                    scales: {
                        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Occupancy %' } }
                    }
                });
            }

            // 3. Render Chart 2: Expected vs Actual Students
            if (charts.expected_actual) {
                initChart('chart-expected-actual', 'line', {
                    labels: charts.expected_actual.labels,
                    datasets: [
                        {
                            label: 'Actual Students',
                            data: charts.expected_actual.actual,
                            borderColor: '#059669',
                            backgroundColor: 'rgba(5, 150, 105, 0.1)',
                            fill: true,
                            tension: 0.3
                        },
                        {
                            label: 'Expected Students',
                            data: charts.expected_actual.expected,
                            borderColor: '#6366f1',
                            borderDash: [5, 5],
                            tension: 0.3
                        }
                    ]
                });
            }

            // 4. Render Chart 3: Department-wise Occupancy
            if (charts.department_occupancy) {
                initChart('chart-department-occupancy', 'doughnut', {
                    labels: charts.department_occupancy.labels,
                    datasets: [{
                        data: charts.department_occupancy.data,
                        backgroundColor: ['#4f46e5', '#0284c7', '#10b981', '#f59e0b', '#ec4899']
                    }]
                });
            }

            // 5. Render Chart 4: Daily Trend
            if (charts.daily_trend) {
                initChart('chart-daily-trend', 'line', {
                    labels: charts.daily_trend.labels,
                    datasets: [{
                        label: 'Avg Daily Occupancy %',
                        data: charts.daily_trend.data,
                        borderColor: '#0284c7',
                        tension: 0.3
                    }]
                });
            }

            // 6. Render Chart 5: Time-slot Analysis
            if (charts.timeslot_analysis) {
                initChart('chart-timeslot', 'bar', {
                    labels: charts.timeslot_analysis.labels,
                    datasets: [{
                        label: 'Occupancy % by Period',
                        data: charts.timeslot_analysis.data,
                        backgroundColor: '#f59e0b',
                        borderRadius: 6
                    }]
                });
            }

            // 7. Render Chart 6: Room Utilization
            if (charts.room_utilization) {
                initChart('chart-room-utilization', 'bar', {
                    labels: charts.room_utilization.labels,
                    datasets: [{
                        label: 'Utilization %',
                        data: charts.room_utilization.data,
                        backgroundColor: '#8b5cf6',
                        borderRadius: 6
                    }]
                }, {
                    indexAxis: 'y'
                });
            }
        })
        .catch(err => console.error("Dashboard fetch error:", err));
}

// ==============================================================================
// STUDENT PREDICTION LOGIC (PAGE 5)
// ==============================================================================
function runPrediction(event) {
    if (event) event.preventDefault();

    const payload = {
        department: document.getElementById('pred-dept').value,
        day: document.getElementById('pred-day').value,
        time_slot: document.getElementById('pred-slot').value,
        semester_week: parseInt(document.getElementById('pred-week').value || 10),
        historical_attendance: parseFloat(document.getElementById('pred-history').value || 80.0),
        exam_proximity: parseInt(document.getElementById('pred-exam').value || 0)
    };

    fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('pred-result-card').style.display = 'block';
        document.getElementById('pred-count').innerText = data.predicted_students + ' students';
        document.getElementById('pred-capacity').innerText = data.recommended_min_capacity + ' seats';
        document.getElementById('pred-buffer').innerText = `(+${data.buffer_seats} safety buffer)`;

        // Factors list
        const factorsUl = document.getElementById('pred-factors');
        factorsUl.innerHTML = '';
        data.factors.forEach(f => {
            const li = document.createElement('li');
            li.innerText = f;
            factorsUl.appendChild(li);
        });

        // Store for 1-click optimization
        window.lastPrediction = {
            students: data.predicted_students,
            dept: payload.department,
            slot: payload.time_slot
        };
    })
    .catch(err => console.error("Prediction error:", err));
}

function goToOptimizerWithPrediction() {
    if (window.lastPrediction) {
        window.location.href = `/optimizer?students=${window.lastPrediction.students}&dept=${window.lastPrediction.dept}&slot=${window.lastPrediction.slot}`;
    } else {
        window.location.href = '/optimizer';
    }
}

// ==============================================================================
// AUTONOMOUS OPTIMIZER LOGIC (PAGE 6)
// ==============================================================================
function runSingleOptimization(event) {
    if (event) event.preventDefault();

    const payload = {
        predicted_students: parseInt(document.getElementById('opt-students').value),
        department: document.getElementById('opt-dept').value,
        time_slot: document.getElementById('opt-slot').value,
        equipment_needed: document.getElementById('opt-equipment').value,
        current_room_id: document.getElementById('opt-current-room').value
    };

    fetch('/api/optimize-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('opt-results-section').style.display = 'block';

        const best = data.best_match;
        const comp = data.comparison;

        // Populate Recommendation Card
        if (best) {
            document.getElementById('rec-room-id').innerText = best.room_id;
            document.getElementById('rec-room-details').innerText = `${best.room_type} • ${best.capacity} seats • Floor ${best.floor}, ${best.building}`;
            document.getElementById('rec-score').innerText = `Optimization Score: ${best.score} pts`;

            const reasonsUl = document.getElementById('rec-reasons');
            reasonsUl.innerHTML = '';
            best.reasons.forEach(r => {
                const li = document.createElement('li');
                li.innerText = r;
                reasonsUl.appendChild(li);
            });
        }

        // Populate Before vs After Comparison
        if (comp && comp.current_room_id) {
            document.getElementById('comp-panel').style.display = 'grid';
            document.getElementById('comp-before-room').innerText = comp.current_room_id;
            document.getElementById('comp-before-cap').innerText = comp.current_capacity;
            document.getElementById('comp-before-unused').innerText = comp.unused_before;

            document.getElementById('comp-after-room').innerText = comp.recommended_room_id;
            document.getElementById('comp-after-cap').innerText = comp.recommended_capacity;
            document.getElementById('comp-after-unused').innerText = comp.unused_after;
            document.getElementById('comp-saved-seats').innerText = comp.seats_saved > 0 ? `+${comp.seats_saved} seats saved!` : 'Optimal fit';
        } else {
            document.getElementById('comp-panel').style.display = 'none';
        }

        // Store for approval
        window.currentRecommendation = {
            session_id: 'MANUAL_OPT',
            original_room: comp ? comp.current_room_id : 'N/A',
            recommended_room: best ? best.room_id : 'N/A',
            students: payload.predicted_students,
            capacity_before: comp ? comp.current_capacity : 0,
            capacity_after: best ? best.capacity : 0,
            seats_saved: comp ? comp.seats_saved : 0
        };
    })
    .catch(err => console.error("Optimization error:", err));
}

function approveCurrentAllocation() {
    if (!window.currentRecommendation) return;

    fetch('/api/approve-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.currentRecommendation)
    })
    .then(res => res.json())
    .then(res => {
        alert(res.message);
        document.getElementById('btn-approve').innerText = '✓ Approved and Saved';
        document.getElementById('btn-approve').disabled = true;
    })
    .catch(err => alert("Error approving: " + err));
}

// ==============================================================================
// WHAT-IF SIMULATOR LOGIC (PAGE 7)
// ==============================================================================
function runSimulator(event) {
    if (event) event.preventDefault();

    const scenario = document.getElementById('sim-scenario').value;
    const closedRooms = [];
    document.querySelectorAll('.closed-room-checkbox:checked').forEach(cb => closedRooms.push(cb.value));

    const surgePct = parseFloat(document.getElementById('sim-surge').value || 0);
    const multiplier = 1.0 + (surgePct / 100.0);

    const payload = {
        scenario: scenario,
        closed_rooms: closedRooms,
        attendance_multiplier: multiplier
    };

    fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('sim-results-card').style.display = 'block';

        // Update Before vs After metrics
        document.getElementById('sim-before-rooms').innerText = data.before.rooms_used;
        document.getElementById('sim-before-conflicts').innerText = data.before.conflicts;
        document.getElementById('sim-before-util').innerText = data.before.average_utilization + '%';

        document.getElementById('sim-after-rooms').innerText = data.after.rooms_used;
        document.getElementById('sim-after-conflicts').innerText = data.after.conflicts;
        document.getElementById('sim-after-util').innerText = data.after.average_utilization + '%';

        document.getElementById('sim-reallocated-count').innerText = `${data.after.reallocated_count} classes dynamically shifted`;

        // Render sessions table
        const tbody = document.getElementById('sim-sessions-tbody');
        tbody.innerHTML = '';
        data.simulated_sessions.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s.session_id}</strong></td>
                <td>${s.subject} (${s.department})</td>
                <td>${s.time_slot}</td>
                <td>${s.students_before} → <strong>${s.students_after}</strong></td>
                <td><span class="badge ${s.was_reallocated ? 'badge-warning' : 'badge-secondary'}">${s.room_before}</span></td>
                <td><span class="badge badge-success">${s.room_after}</span></td>
                <td><small>${s.reason}</small></td>
            `;
            tbody.appendChild(tr);
        });
    })
    .catch(err => console.error("Simulation error:", err));
}

// ==============================================================================
// EVENT PREDICTOR LOGIC (PAGE 8)
// ==============================================================================
function runEventPrediction(event) {
    if (event) event.preventDefault();

    const payload = {
        event_name: document.getElementById('evt-name').value,
        event_type: document.getElementById('evt-type').value,
        date: document.getElementById('evt-date').value,
        registration_count: parseInt(document.getElementById('evt-registrations').value),
        historical_turnout: parseFloat(document.getElementById('evt-turnout').value || 78.0),
        duration_hours: parseInt(document.getElementById('evt-duration').value || 2)
    };

    fetch('/api/predict-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById('evt-results-card').style.display = 'block';
        document.getElementById('evt-predicted-attendees').innerText = data.predicted_attendees + ' attendees';
        document.getElementById('evt-min-capacity').innerText = data.recommended_min_capacity + ' seats required';
        document.getElementById('evt-explanation').innerText = data.explanation;

        if (data.best_venue) {
            document.getElementById('evt-venue-name').innerText = `${data.best_venue.room_id} (${data.best_venue.room_type})`;
            document.getElementById('evt-venue-details').innerText = `${data.best_venue.capacity} total seats • Floor ${data.best_venue.floor}, ${data.best_venue.building} • ${data.best_venue.unused_seats} spare seats`;
        }
    })
    .catch(err => console.error("Event prediction error:", err));
}

// ==============================================================================
// FLOATING AI ASSISTANT (BOTTOM RIGHT) LOGIC
// ==============================================================================
function toggleAIAssistant() {
    const drawer = document.getElementById('ai-assistant-drawer');
    if (!drawer) return;
    const isHidden = drawer.style.display === 'none' || drawer.style.display === '';
    drawer.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
        const input = document.getElementById('ai-chat-input');
        if (input) input.focus();
        scrollAIChatToBottom();
    }
}

function openAIAssistant() {
    const drawer = document.getElementById('ai-assistant-drawer');
    if (!drawer) return;
    drawer.style.display = 'flex';
    const input = document.getElementById('ai-chat-input');
    if (input) input.focus();
    scrollAIChatToBottom();
}

function closeAIAssistant() {
    const drawer = document.getElementById('ai-assistant-drawer');
    if (drawer) drawer.style.display = 'none';
}

function scrollAIChatToBottom() {
    const chatBody = document.getElementById('ai-chat-body');
    if (chatBody) {
        setTimeout(() => {
            chatBody.scrollTop = chatBody.scrollHeight;
        }, 50);
    }
}

function getSmartAIResponse(userPrompt) {
    const q = userPrompt.toLowerCase();

    if (q.includes('what is this project') || q.includes('overview') || q.includes('purpose') || q.includes('about')) {
        return `<strong>🏫 ClassOpt AI — College Classroom Resource Optimization System</strong><br><br>
        ClassOpt AI is an intelligent academic resource optimization platform engineered to solve physical classroom scheduling, overcrowding, and underutilization bottlenecks.<br><br>
        <strong>Key Pillars:</strong><br>
        • <strong>ML Attendance Predictor:</strong> Predicts student turnout using Linear Regression with an MAE of ~5.3 students.<br>
        • <strong>6-Constraint Room Optimizer:</strong> Evaluates capacity, availability, clashes, lab equipment, tightness of fit, and proximity.<br>
        • <strong>+10% Dynamic Safety Buffer:</strong> Prevents sudden walk-in overcrowding.<br>
        • <strong>What-If Scenario Simulator:</strong> Stress-tests room closures or attendance surges safely in memory.<br>
        • <strong>Energy &amp; Space Savings:</strong> Prevents wasting air conditioning and electricity in oversized lecture halls.`;
    }

    if (q.includes('formula') || q.includes('calculate') || q.includes('occupancy') || q.includes('utilization')) {
        return `<strong>📐 Key Resource Optimization Formulas:</strong><br><br>
        1. <strong>Classroom Occupancy Rate (%)</strong>:<br>
        <code>Occupancy % = (Actual Students / Room Capacity) × 100</code><br>
        • Ideal: 70% – 85%<br>
        • Underutilized: &lt; 50% (wastes energy &amp; space)<br>
        • Overcrowded: &gt; 100% (critical deficit)<br><br>
        2. <strong>Room Utilization Rate (%)</strong>:<br>
        <code>Utilization % = (Hours Used / Available Hours) × 100</code><br>
        • Based on typical 40-hour college operational week.<br><br>
        3. <strong>Dynamic Safety Buffer</strong>:<br>
        <code>Target Capacity = Predicted Attendance + 10%</code><br><br>
        4. <strong>Wasted Capacity</strong>:<br>
        <code>Wasted Seats = Room Capacity - Actual Attendance</code>`;
    }

    if (q.includes('score') || q.includes('scoring') || q.includes('algorithm') || q.includes('constraint')) {
        return `<strong>⚙️ 6-Constraint Autonomous Scoring Algorithm:</strong><br><br>
        1. <strong>Capacity Adequacy (+40 pts):</strong> Room Capacity &ge; (Predicted Students + 10% Buffer). Rejects if deficit.<br>
        2. <strong>Operational Availability (+30 pts):</strong> Room is free and active.<br>
        3. <strong>Schedule Free (+20 pts):</strong> Zero clash with existing timetable sessions.<br>
        4. <strong>Equipment Match (+15 pts):</strong> Required projector or lab facilities present.<br>
        5. <strong>Tightest Fit Bonus (Up to +20 pts):</strong> <code>max(0, 20 - int(Unused / 5))</code>. Penalizes assigning small classes to huge halls.<br>
        6. <strong>Department Proximity (+10 pts):</strong> Same building wing as student department.<br><br>
        <em>Highest total score is autonomously recommended.</em>`;
    }

    if (q.includes('viva') || q.includes('defense') || q.includes('question') || q.includes('exam')) {
        return `<strong>🎓 Top Viva Defense Questions &amp; Model Answers:</strong><br><br>
        <strong>Q1: Why Linear Regression instead of Deep Learning?</strong><br>
        <em>Answer:</em> Attendance data is tabular and structured. Linear regression is mathematically transparent (examiners can review feature weights), trains in milliseconds, avoids overfitting, and achieves a strong MAE of ~5.3 students without requiring expensive GPUs.<br><br>
        <strong>Q2: How does the optimizer prevent clashes?</strong><br>
        <em>Answer:</em> It maintains a composite key <code>(room_id, day, time_slot)</code>. Before allocating any room, it cross-checks scheduled classes to guarantee zero double bookings.<br><br>
        <strong>Q3: How is missing data handled?</strong><br>
        <em>Answer:</em> Numeric columns are imputed with median (outlier-resistant); categorical columns with mode.`;
    }

    if (q.includes('ml') || q.includes('model') || q.includes('regression') || q.includes('mae') || q.includes('attendance')) {
        return `<strong>🤖 Machine Learning Architecture &amp; Metrics:</strong><br><br>
        • <strong>Model:</strong> Multiple Linear Regression with Scikit-learn Pipeline &amp; OneHotEncoder.<br>
        • <strong>Features:</strong> Department, Day of Week, Time Slot, Semester Week, Historical Attendance Rate, Exam Proximity.<br>
        • <strong>Target:</strong> Actual Student Count.<br>
        • <strong>Evaluation:</strong> Mean Absolute Error (MAE) of ~5.3 students, RMSE of ~9.3 students.<br>
        • <strong>Safety Cushion:</strong> +10% automated buffer added to predicted attendance before room matching.`;
    }

    if (q.includes('conflict') || q.includes('clash') || q.includes('double booking')) {
        return `<strong>⚠️ Schedule Conflict Detection Engine:</strong><br><br>
        Scans all timetable slots across 3 critical conditions:<br>
        1. <strong>Double Bookings:</strong> Multiple professors/courses assigned to the exact same room at the same time.<br>
        2. <strong>Capacity Deficits:</strong> Classes where student enrollment exceeds room capacity.<br>
        3. <strong>Equipment Mismatch:</strong> Practical/lab sessions assigned to general classrooms without lab equipment.<br><br>
        <em>Click the <strong>Conflicts</strong> tab in top navigation to view the live detector.</em>`;
    }

    if (q.includes('upload') || q.includes('clean') || q.includes('dataset') || q.includes('data')) {
        return `<strong>📊 Dataset &amp; Upload Pipeline:</strong><br><br>
        • <strong>Preloaded:</strong> 5,000 collegiate class sessions across CSE, AIDS, IT, ECE, and EEE.<br>
        • <strong>Custom Upload:</strong> Head to the <strong>Upload</strong> tab in the navigation bar to upload your college's Excel or CSV files.<br>
        • <strong>Inspection:</strong> Automatically validates headers, detects missing values, checks duplicates, and cleans data via Pandas.`;
    }

    return `<strong>💡 Campus Resource Copilot:</strong><br><br>
    I can help you with anything regarding classroom optimization!<br><br>
    Try asking about:<br>
    • <strong>"What are the key formulas?"</strong><br>
    • <strong>"How does the scoring algorithm work?"</strong><br>
    • <strong>"Explain viva questions"</strong><br>
    • <strong>"Tell me about the ML model"</strong><br>
    • <strong>"How to detect timetable conflicts?"</strong>`;
}

function handleAIChatSubmit(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('ai-chat-input');
    if (!input) return;
    const prompt = input.value.trim();
    if (!prompt) return;

    input.value = '';
    sendAIPrompt(prompt);
}

function sendAIPrompt(promptText) {
    const chatBody = document.getElementById('ai-chat-body');
    if (!chatBody) return;

    // 1. Append user message
    const userRow = document.createElement('div');
    userRow.className = 'ai-msg-row ai-msg-row-user';
    userRow.innerHTML = `<div class="ai-msg-bubble ai-msg-bubble-user">${escapeHtml(promptText)}</div>`;
    chatBody.appendChild(userRow);
    scrollAIChatToBottom();

    // 2. Append temporary typing indicator
    const typingRow = document.createElement('div');
    typingRow.className = 'ai-msg-row ai-msg-row-assistant';
    typingRow.id = 'ai-typing-indicator';
    typingRow.innerHTML = `
        <div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="ai-msg-bubble ai-msg-bubble-assistant" style="color: #64748b; font-style: italic;">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing campus resources...
        </div>
    `;
    chatBody.appendChild(typingRow);
    scrollAIChatToBottom();

    // 3. Generate response after brief realistic delay
    setTimeout(() => {
        const indicator = document.getElementById('ai-typing-indicator');
        if (indicator) indicator.remove();

        const responseHtml = getSmartAIResponse(promptText);

        const aiRow = document.createElement('div');
        aiRow.className = 'ai-msg-row ai-msg-row-assistant';
        aiRow.innerHTML = `
            <div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="ai-msg-bubble ai-msg-bubble-assistant">
                ${responseHtml}
            </div>
        `;
        chatBody.appendChild(aiRow);
        scrollAIChatToBottom();
    }, 400);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

// Attach event listeners when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const fabBtn = document.getElementById('fab-ai-toggle');
    if (fabBtn) {
        fabBtn.addEventListener('click', toggleAIAssistant);
    }

    const closeBtn = document.getElementById('ai-drawer-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAIAssistant);
    }

    const chatForm = document.getElementById('ai-chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', handleAIChatSubmit);
    }

    // Quick chips click handlers
    const chips = document.querySelectorAll('.ai-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const query = chip.getAttribute('data-query');
            if (query) {
                sendAIPrompt(query);
            }
        });
    });
});

