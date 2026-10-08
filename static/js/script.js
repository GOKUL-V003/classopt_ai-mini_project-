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
// STUDENT PREDICTION LOGIC (PAGE 5 - ATTENDANCE ML)
// ==============================================================================
window.currentSelectedActual = null;
let currentTablePage = 1;
let debounceFilterTimer = null;

function runPrediction(event) {
    if (event) event.preventDefault();

    const deptEl = document.getElementById('pred-dept');
    const dayEl = document.getElementById('pred-day');
    const slotEl = document.getElementById('pred-slot');
    const weekEl = document.getElementById('pred-week');
    const historyEl = document.getElementById('pred-history');
    const examEl = document.getElementById('pred-exam');
    const subjectEl = document.getElementById('pred-subject');

    if (!deptEl || !dayEl || !slotEl) return;

    const subjectVal = subjectEl ? subjectEl.value.trim() : '';

    const payload = {
        department: deptEl.value,
        day: dayEl.value,
        time_slot: slotEl.value,
        semester_week: parseInt(weekEl ? weekEl.value : 10) || 10,
        historical_attendance: parseFloat(historyEl ? historyEl.value : 80.0) || 80.0,
        exam_proximity: parseInt(examEl ? examEl.value : 0) || 0,
        subject: subjectVal,
        actual_students: window.currentSelectedActual
    };

    fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        const card = document.getElementById('pred-result-card');
        const periodTimeMap = {
            'P1': '09:00 - 10:00',
            'P2': '10:00 - 11:00',
            'P3': '11:15 - 12:15',
            'P4': '12:15 - 01:15',
            'P5': '02:00 - 03:00',
            'P6': '03:00 - 04:00',
            'P7': '04:00 - 05:00',
            'P8': '05:00 - 06:00'
        };

        const slot = payload.time_slot || payload.period || 'P1';
        const timeStr = periodTimeMap[slot] || '';

        const subjectHeading = document.getElementById('pred-subject-heading');
        if (subjectHeading) {
            subjectHeading.innerText = subjectVal ? `${subjectVal} (${payload.department} • Period ${slot}${timeStr ? ' • ' + timeStr : ''})` : `${payload.department} • Period ${slot}`;
        }

        const periodBadge = document.getElementById('pred-period-badge');
        if (periodBadge) {
            periodBadge.innerText = `Period ${slot}${timeStr ? ' (' + timeStr + ')' : ''}`;
        }

        const subjBadge = document.getElementById('pred-subject-badge');
        if (subjBadge) {
            subjBadge.innerText = subjectVal || 'Subject';
        }

        const dayBadge = document.getElementById('pred-day-badge');
        if (dayBadge) {
            dayBadge.innerText = payload.day || 'Day';
        }

        const classMeta = document.getElementById('pred-class-meta');
        if (classMeta) {
            const yr = document.getElementById('pred-year') ? document.getElementById('pred-year').value : '3';
            const sec = document.getElementById('pred-sec') ? document.getElementById('pred-sec').value : 'A';
            classMeta.innerText = `${payload.department} Yr ${yr} • Sec ${sec}`;
        }

        const countEl = document.getElementById('pred-count');
        if (countEl) countEl.innerText = data.predicted_students + ' students';

        const capEl = document.getElementById('pred-capacity');
        if (capEl) capEl.innerText = data.recommended_min_capacity + ' seats';

        const bufferEl = document.getElementById('pred-buffer');
        if (bufferEl) bufferEl.innerText = `(+${data.buffer_seats} safety buffer)`;

        // Actual Attendees Comparison Box
        const compBox = document.getElementById('pred-actual-comparison-box');
        const actDisplay = document.getElementById('pred-actual-display');
        const accDisplay = document.getElementById('pred-accuracy-display');

        if (compBox && data.actual_students !== undefined && data.actual_students !== null) {
            compBox.style.display = 'block';
            if (actDisplay) actDisplay.innerText = data.actual_students + ' students';
            if (accDisplay) {
                const diff = data.difference;
                const diffBadge = diff === 0 
                    ? '<span class="badge badge-success">Exact Match (0)</span>' 
                    : (diff > 0 ? `<span class="badge badge-primary">+${diff} forecast</span>` : `<span class="badge badge-warning">${diff} forecast</span>`);
                accDisplay.innerHTML = `${diffBadge} <span style="font-size: 0.8rem; font-weight: 700; color: #166534; margin-left: 0.35rem;">(${data.accuracy_percent}% match)</span>`;
            }
        } else if (compBox) {
            compBox.style.display = 'none';
        }

        // Factors list
        const factorsUl = document.getElementById('pred-factors');
        if (factorsUl && data.factors) {
            factorsUl.innerHTML = '';
            data.factors.forEach(f => {
                const li = document.createElement('li');
                li.innerText = f;
                factorsUl.appendChild(li);
            });
        }

        // Store for 1-click optimization
        window.lastPrediction = {
            students: data.predicted_students,
            dept: payload.department,
            slot: payload.time_slot
        };
    })
    .catch(err => console.error("Prediction error:", err));
}

function onSelectUploadedClass(selectEl) {
    if (!selectEl || !selectEl.value) return;
    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt) return;

    if (opt.dataset.dept && document.getElementById('pred-dept')) document.getElementById('pred-dept').value = opt.dataset.dept;
    if (opt.dataset.subject && document.getElementById('pred-subject')) document.getElementById('pred-subject').value = opt.dataset.subject;
    if (opt.dataset.slot && document.getElementById('pred-slot')) document.getElementById('pred-slot').value = opt.dataset.slot;
    if (opt.dataset.day && document.getElementById('pred-day')) document.getElementById('pred-day').value = opt.dataset.day;
    if (opt.dataset.history && document.getElementById('pred-history')) document.getElementById('pred-history').value = opt.dataset.history;
    if (opt.dataset.year && document.getElementById('pred-year')) document.getElementById('pred-year').value = opt.dataset.year;
    if (opt.dataset.sec && document.getElementById('pred-sec')) document.getElementById('pred-sec').value = opt.dataset.sec;
    if (opt.dataset.exam !== undefined && document.getElementById('pred-exam')) document.getElementById('pred-exam').value = opt.dataset.exam;

    window.currentSelectedActual = (opt.dataset.actual !== undefined && opt.dataset.actual !== '') ? parseInt(opt.dataset.actual) : null;
    runPrediction();
}

function loadClassIntoForm(c) {
    if (!c) return;
    if (c.department && document.getElementById('pred-dept')) document.getElementById('pred-dept').value = c.department;
    if (c.subject && document.getElementById('pred-subject')) document.getElementById('pred-subject').value = c.subject;
    if (c.time_slot && document.getElementById('pred-slot')) document.getElementById('pred-slot').value = c.time_slot;
    if (c.day && document.getElementById('pred-day')) document.getElementById('pred-day').value = c.day;
    if (c.historical_attendance !== undefined && document.getElementById('pred-history')) {
        document.getElementById('pred-history').value = c.historical_attendance;
    }
    if (c.year && document.getElementById('pred-year')) document.getElementById('pred-year').value = c.year;
    if (c.section && document.getElementById('pred-sec')) document.getElementById('pred-sec').value = c.section;
    if (c.exam_proximity !== undefined && document.getElementById('pred-exam')) {
        document.getElementById('pred-exam').value = c.exam_proximity;
    }

    const sel = document.getElementById('pred-class-select');
    if (sel && c.session_id) {
        sel.value = c.session_id;
    }

    // Smooth scroll down to individual finder form below table
    const formSection = document.getElementById('individual-finder-section') || document.getElementById('attendance-predict-form');
    if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    runPrediction();
}

function debounceFilterClasses() {
    clearTimeout(debounceFilterTimer);
    debounceFilterTimer = setTimeout(() => filterClasses(1), 300);
}

function filterClasses(page) {
    if (page !== undefined) currentTablePage = page;
    const search = document.getElementById('table-search') ? document.getElementById('table-search').value.trim() : '';
    const dept = document.getElementById('table-filter-dept') ? document.getElementById('table-filter-dept').value : 'All';
    const slot = document.getElementById('table-filter-slot') ? document.getElementById('table-filter-slot').value : 'All';
    const day = document.getElementById('table-filter-day') ? document.getElementById('table-filter-day').value : 'All';
    const week = document.getElementById('table-filter-week') ? document.getElementById('table-filter-week').value : 'future';

    const url = `/api/prediction-classes?page=${currentTablePage}&limit=50&search=${encodeURIComponent(search)}&department=${encodeURIComponent(dept)}&time_slot=${encodeURIComponent(slot)}&day=${encodeURIComponent(day)}&week=${encodeURIComponent(week)}`;

    const tbody = document.getElementById('attendance-table-body');
    if (tbody) tbody.style.opacity = '0.5';

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (tbody) tbody.style.opacity = '1';
            if (!data.success) return;

            renderAttendanceTableRows(data.classes, (currentTablePage - 1) * 50);

            const badge = document.getElementById('classes-count-badge');
            if (badge) {
                const weekSuffix = (week === 'future' || week === '1week') ? ' (1-Week Future Schedule)' : '';
                badge.innerText = `Showing ${data.classes.length} of ${data.total} Classes${weekSuffix}`;
            }

            const pageNum = document.getElementById('current-page-num');
            if (pageNum) pageNum.innerText = data.page;

            const totalPages = document.getElementById('total-pages-num');
            if (totalPages) totalPages.innerText = data.total_pages || 1;

            const indicator = document.getElementById('page-indicator');
            if (indicator) indicator.innerText = data.page;

            const btnPrev = document.getElementById('btn-prev-page');
            if (btnPrev) btnPrev.disabled = (data.page <= 1);

            const btnNext = document.getElementById('btn-next-page');
            if (btnNext) btnNext.disabled = (data.page >= data.total_pages);
        })
        .catch(err => {
            if (tbody) tbody.style.opacity = '1';
            console.error("Filter classes error:", err);
        });
}

function changeTablePage(delta) {
    const newPage = currentTablePage + delta;
    if (newPage >= 1) {
        filterClasses(newPage);
    }
}

function renderAttendanceTableRows(classes, offset) {
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody) return;

    if (!classes || classes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
            <strong>No classes match the filter criteria.</strong>
            <p style="font-size: 0.85rem; margin-top: 0.25rem;">Try adjusting the search query, day, or schedule window.</p>
        </td></tr>`;
        return;
    }

    const periodTimeMap = {
        'P1': '09:00 – 10:00',
        'P2': '10:00 – 11:00',
        'P3': '11:15 – 12:15',
        'P4': '12:15 – 01:15',
        'P5': '02:00 – 03:00',
        'P6': '03:00 – 04:00',
        'P7': '04:00 – 05:00',
        'P8': '05:00 – 06:00'
    };

    let html = '';
    classes.forEach((c, idx) => {
        const rowNum = offset + idx + 1;
        const actualStr = (c.actual_students !== null && c.actual_students !== undefined) ? c.actual_students : '—';
        const dateStr = c.date ? `<span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">${c.date}</span>` : '';
        const slotVal = c.time_slot || c.period || 'P1';
        const timingStr = periodTimeMap[slotVal] || (c.period_time || slotVal);

        let deltaHtml = '<span style="color: var(--text-secondary);">—</span>';
        if (c.difference !== null && c.difference !== undefined) {
            if (c.difference === 0) {
                deltaHtml = `<span class="badge badge-success" style="font-size: 0.78rem;">Exact Match (0)</span>`;
            } else if (c.difference > 0) {
                deltaHtml = `<span class="badge badge-primary" style="font-size: 0.78rem;">+${c.difference} students</span>`;
            } else {
                deltaHtml = `<span class="badge badge-warning" style="font-size: 0.78rem;">${c.difference} students</span>`;
            }
            if (c.accuracy_percent !== null && c.accuracy_percent !== undefined) {
                deltaHtml += `<span style="display: block; font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px;">${c.accuracy_percent}% match</span>`;
            }
        }

        const classJson = JSON.stringify(c).replace(/"/g, '&quot;');

        html += `
        <tr id="row-${c.session_id || idx}">
            <td style="text-align: center; color: var(--text-secondary); font-size: 0.8rem; font-weight: 600;">
                ${rowNum}
            </td>
            <td>
                <strong>${c.department || 'CSE'}</strong>
                <span style="font-size: 0.78rem; color: var(--text-secondary); display: block;">
                    Yr ${c.year || 3} • Sec ${c.section || 'A'}
                </span>
            </td>
            <td>
                <span style="font-weight: 700; color: var(--text-primary); font-size: 0.92rem;">
                    ${c.subject || '—'}
                </span>
            </td>
            <td style="text-align: center;">
                <span class="badge badge-primary" style="font-size: 0.82rem; font-weight: 700; display: inline-block;">
                    Period ${slotVal}
                </span>
                <span style="font-size: 0.74rem; color: var(--text-secondary); display: block; margin-top: 3px; font-weight: 600;">
                    ${timingStr}
                </span>
            </td>
            <td>
                <span style="font-size: 0.85rem; font-weight: 600;">${c.day || 'Monday'}</span>
                ${dateStr}
            </td>
            <td>
                <span class="badge badge-secondary" style="font-family: monospace; font-size: 0.82rem;">
                    ${c.room_id || 'R101'}
                </span>
            </td>
            <td style="text-align: center;">
                <span class="badge badge-info" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                    <i class="fa-solid fa-clock"></i> Upcoming
                </span>
            </td>
            <td style="text-align: center;">
                <span style="font-size: 1.05rem; font-weight: 800; color: #16a34a;">
                    ${c.predicted_students}
                </span>
                <span style="display: block; font-size: 0.72rem; color: #16a34a; font-weight: 600;">forecast</span>
            </td>
            <td style="text-align: center;">
                <span style="font-size: 1.05rem; font-weight: 800; color: #0284c7;">
                    ${actualStr}
                </span>
                <span style="display: block; font-size: 0.72rem; color: var(--text-secondary);">baseline</span>
            </td>
            <td style="text-align: center;">
                ${deltaHtml}
            </td>
            <td style="text-align: center;">
                <span style="font-weight: 700; color: #4338ca; font-size: 0.95rem;">
                    ${c.recommended_capacity || (c.predicted_students + 5)} seats
                </span>
                <span style="display: block; font-size: 0.72rem; color: var(--text-secondary);">
                    (+${c.buffer_seats || 5} cushion)
                </span>
            </td>
            <td style="text-align: center;">
                <div style="display: flex; gap: 0.35rem; justify-content: center;">
                    <button type="button" class="btn btn-sm btn-outline-primary" title="Test this class in individual finder below"
                        onclick='loadClassIntoForm(${classJson})'>
                        <i class="fa-solid fa-arrow-down"></i> Test
                    </button>
                    <a href="/optimizer?students=${c.predicted_students}&dept=${c.department}&slot=${c.time_slot}&room=${c.room_id}"
                       class="btn btn-sm btn-outline-success" title="Optimize room for this class">
                        <i class="fa-solid fa-sliders"></i>
                    </a>
                </div>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

function exportAttendanceTableToCSV() {
    const table = document.getElementById('attendance-ml-table');
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll('tr');

    for (let i = 0; i < rows.length; i++) {
        let row = [];
        const cols = rows[i].querySelectorAll('th, td');
        // skip the action column
        for (let j = 0; j < cols.length - 1; j++) {
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/g, ' ').trim();
            data = data.replace(/"/g, '""');
            row.push(`"${data}"`);
        }
        if (row.length > 0) csv.push(row.join(','));
    }

    const csvFile = new Blob([csv.join('\n')], { type: 'text/csv' });
    const downloadLink = document.createElement('a');
    downloadLink.download = 'attendance_ml_predictions_vs_actual.csv';
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
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
function runSingleOptimization(event, sessionContext) {
    if (event) event.preventDefault();

    const studentsEl = document.getElementById('opt-students');
    const deptEl = document.getElementById('opt-dept');
    const slotEl = document.getElementById('opt-slot');
    const equipEl = document.getElementById('opt-equipment');
    const roomEl = document.getElementById('opt-current-room');

    if (!studentsEl || !deptEl || !slotEl) return;

    const payload = {
        predicted_students: parseInt(studentsEl.value) || 60,
        department: deptEl.value,
        time_slot: slotEl.value,
        equipment_needed: equipEl ? equipEl.value : 'Projector',
        current_room_id: roomEl ? roomEl.value : null
    };

    fetch('/api/optimize-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        // Hide placeholder and reveal results card
        const placeholder = document.getElementById('opt-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        const resultsSection = document.getElementById('opt-results-section');
        if (resultsSection) resultsSection.style.display = 'block';

        const best = data.best_match;
        const comp = data.comparison;

        // Populate Recommendation Card
        if (best) {
            document.getElementById('rec-room-id').innerText = best.room_id;
            document.getElementById('rec-room-details').innerText = `${best.room_type} • ${best.capacity} seats • Floor ${best.floor}, ${best.building}`;
            document.getElementById('rec-score').innerText = `Optimization Score: ${best.score} pts`;

            const reasonsUl = document.getElementById('rec-reasons');
            if (reasonsUl) {
                reasonsUl.innerHTML = '';
                best.reasons.forEach(r => {
                    const li = document.createElement('li');
                    li.innerText = r;
                    reasonsUl.appendChild(li);
                });
            }
        }

        // Show session context badge if from sample table
        const sessBadge = document.getElementById('rec-session-badge');
        if (sessBadge) {
            if (sessionContext && sessionContext.sessionId) {
                sessBadge.style.display = 'inline-block';
                sessBadge.innerText = `Session ${sessionContext.sessionId}: ${sessionContext.subject || ''}`;
            } else {
                sessBadge.style.display = 'none';
            }
        }

        // Populate Before vs After Comparison
        if (comp && comp.current_room_id) {
            document.getElementById('comp-panel').style.display = 'grid';
            document.getElementById('comp-before-room').innerText = comp.current_room_id;
            document.getElementById('comp-before-cap').innerText = `${comp.current_capacity} seats`;
            document.getElementById('comp-before-unused').innerText = `${comp.unused_before} seats`;

            document.getElementById('comp-after-room').innerText = comp.recommended_room_id;
            document.getElementById('comp-after-cap').innerText = `${comp.recommended_capacity} seats`;
            document.getElementById('comp-after-unused').innerText = `${comp.unused_after} seats`;
            document.getElementById('comp-saved-seats').innerText = comp.seats_saved > 0 ? `+${comp.seats_saved} seats saved!` : (comp.current_capacity < payload.predicted_students ? 'Deficit resolved!' : 'Optimal fit');
        } else {
            document.getElementById('comp-panel').style.display = 'none';
        }

        // Reset and prepare approval button
        const approveBtn = document.getElementById('btn-approve');
        if (approveBtn) {
            approveBtn.disabled = false;
            const sessText = (sessionContext && sessionContext.sessionId) ? ` (Session ${sessionContext.sessionId})` : '';
            approveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Review & Approve Allocation${sessText}`;
        }

        // Store for approval
        window.currentRecommendation = {
            session_id: sessionContext && sessionContext.sessionId ? sessionContext.sessionId : 'MANUAL_OPT',
            original_room: comp ? comp.current_room_id : (payload.current_room_id || 'N/A'),
            recommended_room: best ? best.room_id : 'N/A',
            students: payload.predicted_students,
            capacity_before: comp ? comp.current_capacity : 0,
            capacity_after: best ? best.capacity : 0,
            seats_saved: comp ? comp.seats_saved : 0,
            notes: sessionContext && sessionContext.sessionId ? `Optimized from Sample Timetable (Session ${sessionContext.sessionId})` : 'Manual Optimization'
        };

        // Smoothly scroll to results section so user sees the output immediately
        if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            resultsSection.style.transition = 'box-shadow 0.3s ease';
            resultsSection.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.4)';
            setTimeout(() => { resultsSection.style.boxShadow = ''; }, 1500);
        }
    })
    .catch(err => {
        console.error("Optimization error:", err);
        alert("Optimization request failed: " + err.message);
    });
}

function optimizeSampleSession(sessionId, subject, department, timeSlot, currentRoom, students, btnElement) {
    if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Optimizing...`;
    }

    // 1. Populate form fields
    const studentsEl = document.getElementById('opt-students');
    if (studentsEl) studentsEl.value = students;

    const slotEl = document.getElementById('opt-slot');
    if (slotEl) slotEl.value = timeSlot;

    const deptEl = document.getElementById('opt-dept');
    if (deptEl) {
        for (let i = 0; i < deptEl.options.length; i++) {
            if (deptEl.options[i].value === department) {
                deptEl.selectedIndex = i;
                break;
            }
        }
    }

    const roomEl = document.getElementById('opt-current-room');
    if (roomEl) {
        let found = false;
        for (let i = 0; i < roomEl.options.length; i++) {
            if (roomEl.options[i].value === currentRoom) {
                roomEl.selectedIndex = i;
                found = true;
                break;
            }
        }
        if (!found) {
            const opt = document.createElement('option');
            opt.value = currentRoom;
            opt.text = `${currentRoom} (Assigned)`;
            opt.selected = true;
            roomEl.appendChild(opt);
        }
    }

    const equipEl = document.getElementById('opt-equipment');
    if (equipEl) {
        const isLab = subject.toLowerCase().includes('lab') || subject.toLowerCase().includes('practical');
        equipEl.value = isLab ? 'Lab' : 'Projector';
    }

    // 2. Run optimization and handle button state
    runSingleOptimization(null, {
        sessionId: sessionId,
        subject: subject,
        department: department,
        currentRoom: currentRoom,
        students: students
    });

    setTimeout(() => {
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.classList.remove('btn-outline');
            btnElement.classList.add('btn-primary');
            btnElement.innerHTML = `<i class="fa-solid fa-check"></i> Optimized`;
        }
    }, 600);
}

function approveCurrentAllocation() {
    if (!window.currentRecommendation) return;

    const approveBtn = document.getElementById('btn-approve');
    if (approveBtn) {
        approveBtn.disabled = true;
        approveBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Saving to Database...`;
    }

    fetch('/api/approve-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(window.currentRecommendation)
    })
    .then(res => res.json())
    .then(res => {
        alert(res.message);
        if (approveBtn) {
            approveBtn.innerText = '✓ Approved and Saved to Database';
            approveBtn.classList.remove('btn-success');
            approveBtn.classList.add('btn-secondary');
        }

        // If a specific row in the sample table was approved, update that row's room badge
        if (window.currentRecommendation.session_id && window.currentRecommendation.session_id !== 'MANUAL_OPT') {
            const row = document.getElementById(`row-${window.currentRecommendation.session_id}`);
            if (row) {
                const roomCell = row.querySelector('.room-badge');
                if (roomCell) {
                    roomCell.innerText = window.currentRecommendation.recommended_room;
                }
            }
        }
    })
    .catch(err => {
        alert("Error approving: " + err);
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Retry Approval`;
        }
    });
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
let lastPredictedEventData = null;

function runEventPrediction(event) {
    if (event) event.preventDefault();

    const preferredVenue = document.getElementById('evt-preferred-venue') ? document.getElementById('evt-preferred-venue').value : 'auto';

    const payload = {
        event_name: document.getElementById('evt-name').value,
        event_type: document.getElementById('evt-type').value,
        date: document.getElementById('evt-date').value,
        registration_count: parseInt(document.getElementById('evt-registrations').value),
        historical_turnout: parseFloat(document.getElementById('evt-turnout').value || 78.0),
        duration_hours: parseInt(document.getElementById('evt-duration').value || 2),
        preferred_venue: preferredVenue
    };

    fetch('/api/predict-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        const resultsCard = document.getElementById('evt-results-card');
        const placeholder = document.getElementById('evt-placeholder');
        if (resultsCard) resultsCard.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';

        document.getElementById('evt-predicted-attendees').innerText = data.predicted_attendees + ' attendees';
        document.getElementById('evt-min-capacity').innerText = data.recommended_min_capacity + ' seats required';
        document.getElementById('evt-explanation').innerText = data.explanation;

        if (data.best_venue) {
            document.getElementById('evt-venue-name').innerText = `${data.best_venue.room_id} (${data.best_venue.room_type})`;
            document.getElementById('evt-venue-details').innerText = `${data.best_venue.capacity} total seats • Floor ${data.best_venue.floor}, ${data.best_venue.building} • ${data.best_venue.unused_seats >= 0 ? data.best_venue.unused_seats + ' spare seats' : Math.abs(data.best_venue.unused_seats) + ' seat shortage'}`;

            // Populate the interactive venue fixer dropdown
            const selector = document.getElementById('evt-fix-venue-selector');
            if (selector && data.all_venues) {
                let optionsHtml = '';
                data.all_venues.forEach(v => {
                    const statusTag = v.is_fit ? `(Fits • +${v.diff} spare)` : `(Short • ${Math.abs(v.diff)} deficit)`;
                    const isSelected = v.room_id === data.best_venue.room_id ? 'selected' : '';
                    optionsHtml += `<option value="${escapeHtml(v.room_id)}" ${isSelected}>${escapeHtml(v.room_id)} — ${escapeHtml(v.room_type)} (${v.capacity} seats) ${statusTag}</option>`;
                });
                selector.innerHTML = optionsHtml;
            }

            // Update badge and status message
            const fixedBadge = document.getElementById('evt-venue-fixed-badge');
            const statusBox = document.getElementById('evt-venue-status-box');

            if (fixedBadge) {
                if (data.is_preferred_fixed) {
                    fixedBadge.className = 'badge badge-success';
                    fixedBadge.innerHTML = '<i class="fa-solid fa-lock"></i> Preferred Venue Fixed';
                } else {
                    fixedBadge.className = 'badge badge-primary';
                    fixedBadge.innerHTML = 'AI Auto-Recommended';
                }
            }

            if (statusBox) {
                if (data.venue_warning) {
                    statusBox.innerHTML = `<div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; padding: 6px 10px; color: #9f1239; font-weight: 600;">${escapeHtml(data.venue_warning)}</div>`;
                } else if (data.venue_notice) {
                    statusBox.innerHTML = `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px 10px; color: #166534; font-weight: 600;">${escapeHtml(data.venue_notice)}</div>`;
                } else {
                    statusBox.innerHTML = `<span style="color: #64748b;">✨ Hall automatically allocated for optimal capacity fit. You can change and fix any venue using the dropdown above.</span>`;
                }
            }

            lastPredictedEventData = {
                event_name: payload.event_name,
                event_type: payload.event_type,
                date: payload.date,
                time_slot: 'Period P2 (10:00 - 11:00)',
                registration_count: payload.registration_count,
                historical_turnout: payload.historical_turnout,
                predicted_attendance: data.predicted_attendees,
                allocated_room_id: data.best_venue.room_id,
                is_preferred_fixed: data.is_preferred_fixed,
                all_venues: data.all_venues
            };
        }
    })
    .catch(err => console.error("Event prediction error:", err));
}

// User changes or fixes preferred venue directly in the prediction card
function onFixedVenueSelectorChanged(selectedRoomId) {
    if (!lastPredictedEventData || !selectedRoomId) return;

    lastPredictedEventData.allocated_room_id = selectedRoomId;
    lastPredictedEventData.is_preferred_fixed = true;

    const matched = (lastPredictedEventData.all_venues || []).find(v => v.room_id === selectedRoomId);
    const fixedBadge = document.getElementById('evt-venue-fixed-badge');
    const statusBox = document.getElementById('evt-venue-status-box');

    if (fixedBadge) {
        fixedBadge.className = 'badge badge-success';
        fixedBadge.innerHTML = '<i class="fa-solid fa-lock"></i> User Fixed Preferred Venue';
    }

    if (matched) {
        document.getElementById('evt-venue-name').innerText = `${matched.room_id} (${matched.room_type})`;
        document.getElementById('evt-venue-details').innerText = `${matched.capacity} total seats • Floor ${matched.floor}, ${matched.building} • ${matched.diff >= 0 ? matched.diff + ' spare seats' : Math.abs(matched.diff) + ' seat shortage'}`;

        if (statusBox) {
            if (matched.diff < 0) {
                statusBox.innerHTML = `<div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; padding: 6px 10px; color: #9f1239; font-weight: 600;">⚠️ Preferred venue '${matched.room_id}' has ${matched.capacity} seats, which is less than expected turnout (${lastPredictedEventData.predicted_attendance} students).</div>`;
            } else {
                statusBox.innerHTML = `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px 10px; color: #166534; font-weight: 600;">🔒 Fixed to preferred venue '${matched.room_id}'. Fits comfortably with ${matched.diff} surplus seats!</div>`;
            }
        }
    }
}

async function bookCurrentPredictedEvent(btn) {
    if (!lastPredictedEventData) {
        alert("Please run event prediction first before booking.");
        return;
    }
    const statusBox = document.getElementById('evt-booking-status');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Booking to Database...`;
    }
    try {
        const res = await fetch('/api/book-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lastPredictedEventData)
        });
        const data = await res.json();
        if (data.success) {
            if (statusBox) {
                statusBox.style.display = 'block';
                statusBox.className = 'alert-box alert-success';
                statusBox.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span><strong>Saved to Database!</strong> Event #${data.event_id} (${lastPredictedEventData.event_name}) booked in Room ${lastPredictedEventData.allocated_room_id} on ${lastPredictedEventData.date} [${data.status}]. Refreshing calendar...</span>`;
            }
            if (btn) {
                btn.innerHTML = `<i class="fa-solid fa-check"></i> Booked Successfully!`;
                btn.classList.add('btn-success');
            }
            setTimeout(() => {
                window.location.reload();
            }, 1200);
        } else {
            alert(`Booking error: ${data.error || 'Failed to save event'}`);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-calendar-check"></i> Book &amp; Save Event to Database Calendar`;
            }
        }
    } catch (err) {
        alert(`Network error: ${err.message}`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-calendar-check"></i> Book &amp; Save Event to Database Calendar`;
        }
    }
}

// Modal functions for changing and fixing preferred venue on existing calendar rows
function openFixVenueModal(eventId, currentRoom, eventName) {
    const modal = document.getElementById('modal-fix-venue');
    if (!modal) return;
    document.getElementById('modal-fix-event-id').value = eventId;
    document.getElementById('modal-fix-event-name').innerText = eventName;
    document.getElementById('modal-fix-current-room').innerText = currentRoom;
    const selectEl = document.getElementById('modal-fix-venue-dropdown');
    if (selectEl) selectEl.value = currentRoom;
    const fb = document.getElementById('modal-fix-feedback');
    if (fb) fb.style.display = 'none';
    modal.style.display = 'flex';
}

function closeFixVenueModal() {
    const modal = document.getElementById('modal-fix-venue');
    if (modal) modal.style.display = 'none';
}

async function submitModalFixVenue(btn) {
    const eventId = document.getElementById('modal-fix-event-id').value;
    const newRoom = document.getElementById('modal-fix-venue-dropdown').value;
    const feedback = document.getElementById('modal-fix-feedback');

    if (!eventId || !newRoom) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...`;
    }

    try {
        const res = await fetch('/api/fix-event-venue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: parseInt(eventId), preferred_venue: newRoom })
        });
        const data = await res.json();
        if (data.success) {
            if (feedback) {
                feedback.style.display = 'block';
                feedback.style.color = '#166534';
                feedback.innerHTML = `<strong>✅ Venue fixed to ${escapeHtml(newRoom)}!</strong> Refreshing calendar...`;
            }
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            alert(`Error fixing venue: ${data.error || 'Failed'}`);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-lock"></i> Fix &amp; Save Venue`;
            }
        }
    } catch (err) {
        alert(`Network error: ${err.message}`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-lock"></i> Fix &amp; Save Venue`;
        }
    }
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

    // 1. Bot capabilities / help
    if (q.includes('what can you') || q.includes('who are you') || q.includes('what are you') || q.includes('help') || q.includes('what do you do') || q.includes('feature') || q.includes('command') || q.includes('capability')) {
        return `<strong>👋 SmartOccupy AI Copilot — Campus Assistant:</strong><br><br>
        Here is everything I can do for you in real time:<br><br>
        • 🚨 <strong>Detect &amp; Resolve Conflicts:</strong> Type <em>"R103 is overcrowded"</em> or <em>"Fix timetable conflicts"</em> to identify capacity shortages and apply 1-click reallocations.<br>
        • 🏫 <strong>Classroom Status:</strong> Check specifications for any room like <em>"Status of R201"</em> or <em>"R103 capacity"</em>.<br>
        • 📐 <strong>Formulas &amp; Metrics:</strong> Ask <em>"What are the formulas?"</em> for Occupancy Rate, Room Utilization, and Dynamic Buffer (+10%).<br>
        • ⚙️ <strong>Autonomous Scoring:</strong> Ask <em>"How does scoring work?"</em> for the 6-constraint optimization logic.<br>
        • 🤖 <strong>Attendance ML:</strong> Ask <em>"Explain ML model"</em> for Linear Regression architecture &amp; MAE metrics.<br>
        • 🎓 <strong>Viva Defense Prep:</strong> Ask <em>"Viva questions"</em> for top exam model answers.`;
    }

    // 2. Room specific or overcrowding queries
    if (q.includes('r101') || q.includes('r102') || q.includes('r103') || q.includes('r104') || q.includes('r105') || 
        q.includes('r201') || q.includes('r202') || q.includes('r203') || q.includes('r204') || 
        q.includes('overcrowd') || q.includes('over crowd') || q.includes('crowded') || q.includes('crowd') || q.includes('deficit')) {
        return `<strong>🚨 Real-Time Classroom &amp; Overcrowding Resolution:</strong><br><br>
        Our AI Copilot monitors classroom occupancy and dynamic +10% safety margins.<br><br>
        • <strong>Automatic Resolution:</strong> Type <em>"Fix timetable conflicts"</em> or head directly to the <a href="/conflicts" style="color: #4f46e5; font-weight: 700; text-decoration: underline;">Conflicts Tab</a>.<br>
        • <strong>Larger Lecture Halls Available:</strong> Rooms <strong>R202</strong> (100 seats) and <strong>R203</strong> (120 seats) in Main Block Floor 2 have high capacity to absorb overflow students.<br>
        • <strong>Action:</strong> Click <em>"Auto-Resolve All Conflicts"</em> in the Conflicts page to reallocate congested sessions instantly.`;
    }

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
    • <strong>"R103 is overcrowded"</strong><br>
    • <strong>"What can you do?"</strong><br>
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

async function sendAIPrompt(promptText) {
    const chatBody = document.getElementById('ai-chat-body');
    if (!chatBody) return;

    // Check if user pasted a Gemini API key directly into the input
    if ((promptText.startsWith('AIzaSy') || (promptText.length >= 35 && !promptText.includes(' '))) && !promptText.includes('\n')) {
        localStorage.setItem('classopt_gemini_key', promptText);
        appendChatMessage('user', '🔑 [Pasted Gemini API Key]');
        appendChatMessage('assistant', '🔑 <strong>Google Gemini API Key Saved!</strong><br>Your key is saved locally in your browser storage. You now have live interactive AI responses powered directly by Google Gemini.');
        return;
    }

    // 1. Append user message
    appendChatMessage('user', escapeHtml(promptText));

    // 2. Append temporary typing indicator
    const typingRow = document.createElement('div');
    typingRow.className = 'ai-msg-row ai-msg-row-assistant';
    typingRow.id = 'ai-typing-indicator';
    typingRow.innerHTML = `
        <div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>
        <div class="ai-msg-bubble ai-msg-bubble-assistant" style="color: #64748b; font-style: italic;">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Real-time AI evaluating constraints & campus resources...
        </div>
    `;
    chatBody.appendChild(typingRow);
    scrollAIChatToBottom();

    // 3. Request real-time Copilot response
    try {
        const apiKey = localStorage.getItem('classopt_gemini_key') || localStorage.getItem('smartoccupy_gemini_key') || '';
        const res = await fetch('/api/ai-chat-copilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText, apiKey: apiKey })
        });

        const data = await res.json();
        removeTypingIndicator();

        // Optional notice banner if Gemini failed and system used offline engine
        let noticeHtml = '';
        if (data.gemini_notice) {
            noticeHtml = `<div class="ai-gemini-notice" style="background: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #ef4444; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; font-size: 11px; color: #9f1239;">${data.gemini_notice}</div>`;
        }

        if (data.is_conflict_response) {
            let html = noticeHtml;
            if (!data.remedies || data.remedies.length === 0) {
                html += data.text || '🎉 <strong>Zero Timetable Conflicts Detected!</strong><br>All scheduled classes fit within capacities and no collisions were found.';
            } else {
                html += `
                    <div style="margin-bottom: 6px;">
                        <span class="ai-source-badge" style="font-size: 10.5px; padding: 2px 8px;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> ${escapeHtml(data.source || 'AI Copilot Engine')}
                        </span>
                    </div>
                    <strong>⚠️ Timetable Conflicts Detected (${data.total_conflicts} Total):</strong><br>
                    <span style="font-size: 11px; color: #64748b;">AI analyzed 6 constraints and calculated optimal remedy rooms:</span>
                `;

                data.remedies.forEach(rem => {
                    html += `
                    <div class="ai-chat-remedy-item">
                        <div style="font-weight: 700; color: #1e293b; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
                            <span>🚨 ${escapeHtml(rem.conflict_type)}: ${escapeHtml(rem.subject)}</span>
                            <span style="color: #4338ca; font-size: 11px;">Score: ${rem.score}/100</span>
                        </div>
                        <p style="font-size: 11.5px; color: #475569; margin: 4px 0; line-height: 1.4;">
                            ${escapeHtml(rem.diagnosis)}
                        </p>
                        <div style="font-size: 11.5px; color: #047857; font-weight: 600; margin-top: 3px;">
                            <i class="fa-solid fa-arrow-right"></i> Move to <strong>Room ${escapeHtml(rem.recommended_room)}</strong> (${rem.recommended_capacity} seats)
                        </div>
                        <button type="button" class="ai-chat-action-btn" onclick="applyAIChatFix('${escapeHtml(rem.session_id)}', '${escapeHtml(rem.recommended_room)}', '${escapeHtml(rem.original_room)}', this)">
                            <i class="fa-solid fa-bolt"></i> Apply Fix (Move to Room ${escapeHtml(rem.recommended_room)})
                        </button>
                    </div>`;
                });
            }
            appendChatMessage('assistant', html);
        } else if (data.text) {
            // ALWAYS display data.text from server if provided
            const formatted = formatMarkdownSimple(data.text);
            const sourceBadge = data.source ? `
                <div style="margin-bottom: 6px;">
                    <span class="ai-source-badge" style="font-size: 10.5px; padding: 2px 8px; ${data.is_live_gemini ? 'background: #e0f2fe; color: #0369a1;' : 'background: #f1f5f9; color: #475569;'}">
                        <i class="fa-solid ${data.is_live_gemini ? 'fa-sparkles' : 'fa-brain'}"></i> ${escapeHtml(data.source)}
                    </span>
                </div>
            ` : '';
            const html = noticeHtml + sourceBadge + formatted;
            appendChatMessage('assistant', html);

            // If action was executed (e.g. SCHEDULE_EVENT) and user is on /events page, reload to display new row
            if (data.action_executed) {
                const instDrawer = document.getElementById('ai-instructions-drawer');
                if (instDrawer && instDrawer.style.display !== 'none') {
                    loadAIInstructions();
                }
                if (window.location.pathname.includes('/events')) {
                    setTimeout(() => {
                        window.location.reload();
                    }, 1800);
                }
            }
        } else {
            // Fallback to local heuristic
            const localReply = getSmartAIResponse(promptText);
            appendChatMessage('assistant', noticeHtml + localReply);
        }
    } catch (err) {
        removeTypingIndicator();
        // Offline heuristic fallback
        const localReply = getSmartAIResponse(promptText);
        appendChatMessage('assistant', localReply);
    }
}

function removeTypingIndicator() {
    const indicator = document.getElementById('ai-typing-indicator');
    if (indicator) indicator.remove();
}

function appendChatMessage(role, htmlContent) {
    const chatBody = document.getElementById('ai-chat-body');
    if (!chatBody) return;

    const row = document.createElement('div');
    row.className = `ai-msg-row ai-msg-row-${role}`;
    if (role === 'assistant') {
        row.innerHTML = `
            <div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="ai-msg-bubble ai-msg-bubble-assistant">${htmlContent}</div>
        `;
    } else {
        row.innerHTML = `
            <div class="ai-msg-bubble ai-msg-bubble-user">${htmlContent}</div>
        `;
    }
    chatBody.appendChild(row);
    scrollAIChatToBottom();
}

// Executes real-time conflict fix directly from within the chat window
async function applyAIChatFix(sessionId, newRoom, origRoom, btnElement) {
    if (btnElement) {
        btnElement.disabled = true;
        btnElement.classList.add('applied');
        btnElement.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Reallocating in DB...`;
    }

    try {
        const res = await fetch('/api/resolve-conflict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                new_room_id: newRoom,
                original_room: origRoom,
                notes: 'Resolved via Floating AI Copilot Chat'
            })
        });

        const data = await res.json();

        if (data.success) {
            if (btnElement) {
                btnElement.innerHTML = `<i class="fa-solid fa-circle-check"></i> Reallocated to Room ${escapeHtml(newRoom)}`;
            }

            appendChatMessage('assistant', `
                <div style="color: #166534; font-size: 12px;">
                    <strong>🎉 Database Updated!</strong><br>
                    Session <code>${escapeHtml(sessionId)}</code> (${escapeHtml(data.subject || 'Class')}) has been reallocated from <strong>Room ${escapeHtml(origRoom)}</strong> to <strong>Room ${escapeHtml(newRoom)}</strong>.<br>
                    Timetable and Attendance records updated in real time.
                </div>
            `);

            // If the user happens to be on the conflicts page, reflect changes immediately
            const kpiTotal = document.getElementById('kpi-total-conflicts');
            if (kpiTotal && data.remaining_count !== undefined) {
                kpiTotal.innerText = data.remaining_count;
            }
            const card = document.getElementById(`card-${sessionId}`);
            if (card) {
                card.classList.add('card-conflict-resolved');
            }
        } else {
            alert(`Error: ${data.error || 'Failed to reallocate session'}`);
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.classList.remove('applied');
                btnElement.innerHTML = `<i class="fa-solid fa-bolt"></i> Retry Apply Fix`;
            }
        }
    } catch (err) {
        alert(`Network error: ${err.message}`);
        if (btnElement) {
            btnElement.disabled = false;
            btnElement.classList.remove('applied');
            btnElement.innerHTML = `<i class="fa-solid fa-bolt"></i> Retry Apply Fix`;
        }
    }
}

function formatMarkdownSimple(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = String(text);
    return div.innerHTML;
}

// Function to fetch and display persistent AI chatbot instructions from SQLite database
async function loadAIInstructions() {
    const listEl = document.getElementById('ai-instructions-list');
    if (!listEl) return;
    listEl.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 10px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching stored instructions...</div>`;

    try {
        const res = await fetch('/api/ai-chat-instructions?limit=30');
        const data = await res.json();
        if (data.success && data.instructions && data.instructions.length > 0) {
            let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
            data.instructions.forEach(item => {
                const isSchedule = item.action_type === 'SCHEDULE_EVENT' || item.action_type === 'DIRECT_EVENT_BOOKING';
                const badgeColor = isSchedule ? '#059669' : '#4f46e5';
                const statusBadge = item.execution_status === 'SUCCESS' ? 'badge-success' : 'badge-warning';
                html += `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: 700; color: ${badgeColor}; font-size: 11px;">
                            #${item.id} [${escapeHtml(item.action_type)}]
                        </span>
                        <span class="badge ${statusBadge}" style="font-size: 10px; padding: 2px 6px;">
                            ${escapeHtml(item.execution_status)}
                        </span>
                    </div>
                    <div style="color: #1e293b; font-weight: 600; font-size: 11.5px; margin-bottom: 3px;">
                        "${escapeHtml(item.user_prompt)}"
                    </div>
                    <div style="font-size: 10px; color: #64748b; display: flex; justify-content: space-between;">
                        <span><i class="fa-regular fa-clock"></i> ${escapeHtml(item.timestamp || '')}</span>
                        <span><i class="fa-solid fa-robot"></i> ${escapeHtml(item.source || 'SmartOccupy Copilot')}</span>
                    </div>
                </div>`;
            });
            html += '</div>';
            listEl.innerHTML = html;
        } else {
            listEl.innerHTML = `<div style="text-align: center; color: #64748b; padding: 12px;">No stored AI instructions found yet.</div>`;
        }
    } catch (err) {
        listEl.innerHTML = `<div style="color: #dc2626; padding: 10px;">Error loading instructions: ${escapeHtml(err.message)}</div>`;
    }
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

    // AI Instructions Drawer handlers
    const instToggleBtn = document.getElementById('ai-instructions-toggle-btn');
    const instDrawer = document.getElementById('ai-instructions-drawer');
    const instCloseBtn = document.getElementById('ai-instructions-drawer-close');
    const instRefreshBtn = document.getElementById('btn-refresh-instructions');

    if (instToggleBtn && instDrawer) {
        instToggleBtn.addEventListener('click', () => {
            const isHidden = instDrawer.style.display === 'none' || instDrawer.style.display === '';
            instDrawer.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                loadAIInstructions();
            }
        });
    }

    if (instCloseBtn && instDrawer) {
        instCloseBtn.addEventListener('click', () => {
            instDrawer.style.display = 'none';
        });
    }

    if (instRefreshBtn) {
        instRefreshBtn.addEventListener('click', () => {
            loadAIInstructions();
        });
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

    // Gemini API Key drawer handlers
    const keyToggleBtn = document.getElementById('ai-key-toggle-btn');
    const keyDrawer = document.getElementById('ai-key-drawer');
    const keyCloseBtn = document.getElementById('ai-key-drawer-close');
    const keyInput = document.getElementById('ai-gemini-key-input');
    const saveKeyBtn = document.getElementById('btn-save-gemini-key');
    const clearKeyBtn = document.getElementById('btn-clear-gemini-key');

    const savedKey = localStorage.getItem('classopt_gemini_key') || localStorage.getItem('smartoccupy_gemini_key') || '';
    if (keyInput && savedKey) {
        keyInput.value = savedKey;
    }

    if (keyToggleBtn && keyDrawer) {
        keyToggleBtn.addEventListener('click', () => {
            keyDrawer.style.display = keyDrawer.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (keyCloseBtn && keyDrawer) {
        keyCloseBtn.addEventListener('click', () => {
            keyDrawer.style.display = 'none';
        });
    }

    if (saveKeyBtn && keyInput) {
        saveKeyBtn.addEventListener('click', () => {
            const keyVal = keyInput.value.trim();
            if (keyVal) {
                localStorage.setItem('classopt_gemini_key', keyVal);
                if (keyDrawer) keyDrawer.style.display = 'none';
                appendChatMessage('assistant', '🔑 <strong>Google Gemini API Key Saved!</strong><br>Live AI responses from Google Gemini are now active in this browser session.');
            }
        });
    }

    if (clearKeyBtn && keyInput) {
        clearKeyBtn.addEventListener('click', () => {
            localStorage.removeItem('classopt_gemini_key');
            localStorage.removeItem('smartoccupy_gemini_key');
            keyInput.value = '';
            if (keyDrawer) keyDrawer.style.display = 'none';
            appendChatMessage('assistant', '🗑️ <strong>Gemini API Key Removed.</strong><br>The Copilot will now operate in offline smart reasoning mode.');
        });
    }
});

