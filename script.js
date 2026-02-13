const state = {
  defects: [],
  opps: [],
  defectHeaders: [],
  oppHeaders: []
};

const els = {
  defectsFile: document.getElementById('defectsFile'),
  oppsFile: document.getElementById('oppsFile'),
  status: document.getElementById('fileStatus'),
  themeToggle: document.getElementById('themeToggle'),
  runAnalysis: document.getElementById('runAnalysis'),
  paretoCanvas: document.getElementById('paretoCanvas'),
  paretoSummary: document.getElementById('paretoSummary'),
  fishboneGrid: document.getElementById('fishboneGrid'),
  capaBody: document.querySelector('#capaTable tbody'),
  defectCategorySelect: document.getElementById('defectCategorySelect'),
  defectCauseSelect: document.getElementById('defectCauseSelect'),
  defectCountSelect: document.getElementById('defectCountSelect'),
  oppIdSelect: document.getElementById('oppIdSelect'),
  oppTitleSelect: document.getElementById('oppTitleSelect'),
  oppOwnerSelect: document.getElementById('oppOwnerSelect'),
  oppDueDateSelect: document.getElementById('oppDueDateSelect'),
  oppStatusSelect: document.getElementById('oppStatusSelect')
};

const fishboneBuckets = {
  People: ['training', 'operator', 'communication', 'staff', 'handoff', 'knowledge'],
  Process: ['workflow', 'procedure', 'process', 'inspection', 'control', 'checklist'],
  Equipment: ['machine', 'tool', 'system', 'calibration', 'software', 'hardware'],
  Materials: ['material', 'component', 'supplier', 'batch', 'part'],
  Environment: ['temperature', 'humidity', 'lighting', 'noise', 'workspace'],
  Measurement: ['metric', 'measurement', 'data', 'reporting', 'sampling', 'test']
};

function setTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('dashboard-theme', theme);
  els.themeToggle.textContent = theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode';
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length || row.length) {
    row.push(current.trim());
    if (row.some(Boolean)) rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map(r => Object.fromEntries(headers.map((h, idx) => [h, r[idx] || ''])));
}

function fillSelect(selectEl, headers, preferred = []) {
  selectEl.innerHTML = '';
  headers.forEach((h) => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    selectEl.appendChild(opt);
  });

  const preferredHeader = headers.find(h => preferred.some(p => h.toLowerCase().includes(p)));
  if (preferredHeader) selectEl.value = preferredHeader;
}

function updateStatus() {
  const d = state.defects.length ? `Defects: ${state.defects.length} rows` : 'Defects: missing';
  const o = state.opps.length ? `Opportunities: ${state.opps.length} rows` : 'Opportunities: missing';
  els.status.textContent = `${d} | ${o}`;
}

async function loadFile(file, type) {
  if (!file) return;
  const text = await file.text();
  const data = parseCSV(text);
  if (type === 'defects') {
    state.defects = data;
    state.defectHeaders = Object.keys(data[0] || {});
    fillSelect(els.defectCategorySelect, state.defectHeaders, ['category', 'defect', 'type']);
    fillSelect(els.defectCauseSelect, state.defectHeaders, ['cause', 'root']);
    fillSelect(els.defectCountSelect, state.defectHeaders, ['count', 'qty', 'quantity']);
  } else {
    state.opps = data;
    state.oppHeaders = Object.keys(data[0] || {});
    fillSelect(els.oppIdSelect, state.oppHeaders, ['id', 'number']);
    fillSelect(els.oppTitleSelect, state.oppHeaders, ['title', 'issue', 'description']);
    fillSelect(els.oppOwnerSelect, state.oppHeaders, ['owner', 'assignee']);
    fillSelect(els.oppDueDateSelect, state.oppHeaders, ['due', 'date']);
    fillSelect(els.oppStatusSelect, state.oppHeaders, ['status', 'state']);
  }
  updateStatus();
}

function runPareto() {
  const categoryCol = els.defectCategorySelect.value;
  const countCol = els.defectCountSelect.value;
  if (!categoryCol || !state.defects.length) return;

  const totals = new Map();
  for (const row of state.defects) {
    const category = row[categoryCol] || 'Unspecified';
    const numeric = Number(row[countCol]);
    const value = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
    totals.set(category, (totals.get(category) || 0) + value);
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const overall = sorted.reduce((sum, [, v]) => sum + v, 0);
  let running = 0;
  const withPct = sorted.map(([name, count]) => {
    running += count;
    return { name, count, pct: (running / overall) * 100 };
  });

  drawPareto(els.paretoCanvas, withPct);

  const focusCount = withPct.filter(x => x.pct <= 80).length || 1;
  els.paretoSummary.textContent = `${focusCount} categories account for ~80% of total issues.`;
}

function drawPareto(canvas, data) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#e6edf3' : '#1f2937';
  const gridColor = isDark ? '#30363d' : '#d1d5db';

  const pad = { t: 30, r: 55, b: 110, l: 50 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const max = Math.max(...data.map(d => d.count), 1);

  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.font = '12px sans-serif';

  for (let i = 0; i <= 5; i++) {
    const y = pad.t + chartH - (chartH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.stroke();
  }

  const barW = chartW / Math.max(data.length, 1) * 0.7;
  data.forEach((d, i) => {
    const x = pad.l + (chartW * (i + 0.15)) / data.length;
    const h = (d.count / max) * chartH;
    const y = pad.t + chartH - h;

    ctx.fillStyle = '#0b64d7';
    ctx.fillRect(x, y, barW, h);

    ctx.save();
    ctx.translate(x + barW / 2, H - 8);
    ctx.rotate(-0.7);
    ctx.fillStyle = textColor;
    ctx.fillText(d.name.slice(0, 20), 0, 0);
    ctx.restore();
  });

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = pad.l + (chartW * (i + 0.15)) / data.length + barW / 2;
    const y = pad.t + chartH - (d.pct / 100) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.fillText('Cumulative %', W - pad.r - 70, 15);
  ctx.fillText('Count', 12, 15);
}

function runFishbone() {
  const causeCol = els.defectCauseSelect.value;
  const output = {
    People: [], Process: [], Equipment: [], Materials: [], Environment: [], Measurement: [], Other: []
  };

  state.defects.forEach((row) => {
    const cause = (row[causeCol] || '').trim();
    if (!cause) return;
    const lower = cause.toLowerCase();

    let bucket = 'Other';
    for (const [name, keys] of Object.entries(fishboneBuckets)) {
      if (keys.some(k => lower.includes(k))) {
        bucket = name;
        break;
      }
    }
    if (!output[bucket].includes(cause)) output[bucket].push(cause);
  });

  els.fishboneGrid.innerHTML = '';
  Object.entries(output).forEach(([bucket, items]) => {
    const card = document.createElement('article');
    card.className = 'fishbone-card';
    card.innerHTML = `<h3>${bucket}</h3>`;
    const list = document.createElement('ul');
    (items.length ? items : ['No causes mapped']).slice(0, 8).forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    card.appendChild(list);
    els.fishboneGrid.appendChild(card);
  });
}

function isOverdue(dateText, statusText) {
  const dt = new Date(dateText);
  if (Number.isNaN(dt.getTime())) return false;
  const closed = String(statusText).toLowerCase().includes('closed') || String(statusText).toLowerCase().includes('complete');
  return !closed && dt < new Date();
}

function runCapa() {
  const idCol = els.oppIdSelect.value;
  const titleCol = els.oppTitleSelect.value;
  const ownerCol = els.oppOwnerSelect.value;
  const dueCol = els.oppDueDateSelect.value;
  const statusCol = els.oppStatusSelect.value;

  els.capaBody.innerHTML = '';
  state.opps.forEach((row) => {
    const tr = document.createElement('tr');
    const status = row[statusCol] || 'Open';
    const overdue = isOverdue(row[dueCol], status);
    const statusClass = overdue ? 'overdue' : (String(status).toLowerCase().includes('closed') ? 'closed' : 'open');

    tr.innerHTML = `
      <td>${row[idCol] || ''}</td>
      <td>${row[titleCol] || ''}</td>
      <td>${row[ownerCol] || ''}</td>
      <td><textarea placeholder="Immediate containment action"></textarea></td>
      <td><textarea placeholder="Corrective action"></textarea></td>
      <td><textarea placeholder="Preventive action"></textarea></td>
      <td>${row[dueCol] || ''}</td>
      <td><span class="tag ${statusClass}">${overdue ? 'Overdue' : status}</span></td>
    `;

    els.capaBody.appendChild(tr);
  });
}

els.defectsFile.addEventListener('change', (e) => loadFile(e.target.files[0], 'defects'));
els.oppsFile.addEventListener('change', (e) => loadFile(e.target.files[0], 'opps'));
els.runAnalysis.addEventListener('click', () => {
  runPareto();
  runFishbone();
  runCapa();
});
els.themeToggle.addEventListener('click', () => {
  const next = document.body.classList.contains('dark') ? 'light' : 'dark';
  setTheme(next);
  if (state.defects.length) runPareto();
});

setTheme(localStorage.getItem('dashboard-theme') || 'light');
updateStatus();
