import { WsClient } from './ws.js';
import { SimView   } from './simulation.js';
import { UniverseCreator } from './creator.js';

// ── State ─────────────────────────────────────────────────────────────────────
const views   = {};  // slot → SimView
const states  = {};  // slot → latest server state
let activeSlot = 1;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const connIndicator    = document.getElementById('conn-indicator');
const activeNameEl     = document.getElementById('active-universe-name');
const activeSlotBadge  = document.getElementById('active-slot-badge');
const tickDisplayEl    = document.getElementById('tick-display');
const canvasContainer  = document.getElementById('canvas-container');
const hudEl            = document.getElementById('hud');
const slotsAreaEl      = document.getElementById('slots-area');
const universeListEl   = document.getElementById('universe-list');
const creatorBackdrop  = document.getElementById('creator-backdrop');
const btnNewUniverse   = document.getElementById('btn-new-universe');
const btnStart         = document.getElementById('btn-start');
const btnStop          = document.getElementById('btn-stop');
const btnReset         = document.getElementById('btn-reset');

// ── Universe Creator ──────────────────────────────────────────────────────────
const creator = new UniverseCreator(creatorBackdrop);
creator.onSave = async (cfg, slot) => {
  // 1. Save universe config to server
  const saveRes = await fetch('/api/universes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  });
  if (!saveRes.ok) {
    const body = await saveRes.json().catch(() => ({}));
    throw new Error((body.errors || body.error || ['Save failed']).join(', '));
  }
  const { universe } = await saveRes.json();

  // 2. Launch in chosen slot
  await launchInSlot(slot, universe.config || universe);
  await refreshUniverseList();
};

btnNewUniverse?.addEventListener('click', () => creator.open(null, activeSlot));

// ── Slot management ───────────────────────────────────────────────────────────
function ensureView(slot) {
  if (views[slot]) return views[slot];

  let vp = document.getElementById(`viewport-${slot}`);
  if (!vp) {
    vp = document.createElement('div');
    vp.id = `viewport-${slot}`;
    vp.className = 'slot-viewport';
    const lbl = document.createElement('div');
    lbl.className = 'slot-label-overlay';
    lbl.textContent = `Slot ${slot}`;
    vp.appendChild(lbl);
    canvasContainer.appendChild(vp);
  }

  views[slot] = new SimView(vp);
  return views[slot];
}

function destroyView(slot) {
  if (views[slot]) {
    views[slot].destroy();
    delete views[slot];
  }
  const vp = document.getElementById(`viewport-${slot}`);
  if (vp) vp.remove();
}

async function launchInSlot(slot, universeConfig) {
  const res = await fetch(`/api/instances/${slot}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ universeConfig }),
  });
  if (!res.ok) throw new Error('Failed to launch instance');
  const { state } = await res.json();
  ensureView(slot);
  states[slot] = state;
  views[slot]?.applyState(state);
  await fetch(`/api/instances/${slot}/start`, { method: 'POST' });
  renderSlotCards();
  if (slot === activeSlot) updateHUD();
}

function setActiveSlot(slot) {
  activeSlot = slot;
  renderSlotCards();
  updateHUD();
  updateTopBar();
}

// ── WS client ─────────────────────────────────────────────────────────────────
const ws = new WsClient(`ws://${location.host}/ws`);

ws.on('_connected', () => {
  connIndicator.classList.add('connected');
});
ws.on('_disconnected', () => {
  connIndicator.classList.remove('connected');
});

ws.on('welcome', payload => {
  for (const inst of (payload.instances || [])) {
    const slot = inst.slot;
    ensureView(slot);
    states[slot] = inst;
    views[slot]?.applyState(inst);
  }
  renderSlotCards();
  updateHUD();
  updateTopBar();
});

ws.on('tick', payload => {
  const slot = payload.slot;
  states[slot] = payload;
  const view = views[slot];
  if (view) {
    view.applyState(payload);
    view.applyEvents(payload.events);
  }
  if (slot === activeSlot) {
    updateHUD();
    updateTopBar();
  }
  renderSlotTickBadges();
});

ws.on('started', payload => {
  const slot = payload.slot;
  if (states[slot]) states[slot].running = true;
  if (slot === activeSlot) updateControlButtons();
});

ws.on('stopped', payload => {
  const slot = payload.slot;
  if (states[slot]) states[slot].running = false;
  if (slot === activeSlot) updateControlButtons();
});

ws.on('reset', payload => {
  const slot = payload.slot;
  states[slot] = payload;
  views[slot]?.applyState(payload);
  if (slot === activeSlot) updateHUD();
});

ws.on('instance_added', payload => {
  const slot = payload.slot;
  ensureView(slot);
  states[slot] = payload;
  views[slot]?.applyState(payload);
  renderSlotCards();
  updateTopBar();
});

ws.on('config_changed', payload => {
  const slot = payload.slot;
  if (states[slot]) states[slot].universeConfig = payload.config;
  if (slot === activeSlot) updateSliderValues();
});

// ── Control buttons ───────────────────────────────────────────────────────────
btnStart?.addEventListener('click', () => fetch(`/api/instances/${activeSlot}/start`, { method: 'POST' }));
btnStop?.addEventListener('click',  () => fetch(`/api/instances/${activeSlot}/stop`,  { method: 'POST' }));
btnReset?.addEventListener('click', () => fetch(`/api/instances/${activeSlot}/reset`, { method: 'POST' }));

function updateControlButtons() {
  const st = states[activeSlot];
  if (!st) return;
  if (btnStart) btnStart.disabled = st.running;
  if (btnStop)  btnStop.disabled  = !st.running;
}

// ── Slot cards ────────────────────────────────────────────────────────────────
function renderSlotCards() {
  slotsAreaEl.innerHTML = '';
  for (let s = 1; s <= 2; s++) {
    const st = states[s];
    const card = document.createElement('div');
    card.className = 'slot-card' + (s === activeSlot ? ' active' : '') + (!st ? ' empty' : '');
    card.innerHTML = `<div class="slot-label">Slot ${s}</div>
      <div class="slot-universe">${st?.universeConfig?.name || '—'}</div>
      <div class="slot-tick">${st ? `tick ${st.tick}` : 'empty'}</div>`;
    card.addEventListener('click', () => {
      if (st) setActiveSlot(s);
      else {
        setActiveSlot(s);
        creator.open(null, s);
      }
    });
    slotsAreaEl.appendChild(card);
  }
}

function renderSlotTickBadges() {
  for (let s = 1; s <= 2; s++) {
    const card = slotsAreaEl.children[s - 1];
    if (!card) continue;
    const tickEl = card.querySelector('.slot-tick');
    if (tickEl && states[s]) tickEl.textContent = `tick ${states[s].tick}`;
  }
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function updateTopBar() {
  const st = states[activeSlot];
  if (activeNameEl) activeNameEl.textContent = st?.universeConfig?.name || 'No Universe';
  if (activeSlotBadge) activeSlotBadge.textContent = `Slot ${activeSlot}`;
  if (tickDisplayEl && st) tickDisplayEl.textContent = `tick ${st.tick}`;
  updateControlButtons();
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function updateHUD() {
  if (!hudEl) return;
  const st = states[activeSlot];
  if (!st?.stats) { hudEl.innerHTML = ''; return; }

  hudEl.innerHTML = '';

  // Stats table
  const table = document.createElement('div');
  table.className = 'section-title';
  table.textContent = 'Population';
  hudEl.appendChild(table);

  for (const s of st.stats) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-dot" style="background:${s.color}"></span>
      <span class="stat-name">${s.name}</span>
      <span class="stat-count">${s.count}</span>
      <span class="stat-energy" title="Avg energy">⚡${s.avgEnergy}</span>
      <span class="stat-births" title="Births/min">+${s.birthsPerMin}/m</span>
      <span class="stat-deaths" title="Deaths/min">-${s.deathsPerMin}/m</span>
    `;
    hudEl.appendChild(row);
  }

  // Sliders
  const slidersTitle = document.createElement('div');
  slidersTitle.className = 'section-title';
  slidersTitle.style.marginTop = '8px';
  slidersTitle.textContent = 'Runtime Controls';
  hudEl.appendChild(slidersTitle);

  const cfg = st.universeConfig;
  const sliders = [
    { label: 'Tick Speed (ms)', field: 'tickInterval', value: cfg.tickInterval || 200, min: 50, max: 1000, step: 50 },
  ];
  // Per-type sliders for consumer/predator types
  for (const t of (cfg.agentTypes || [])) {
    if (t.role === 'producer') continue;
    sliders.push({ label: `${t.name} Decay`, typeId: t.id, field: 'energyDecayRate', value: t.energyDecayRate, min: 0, max: 10, step: 0.1 });
    sliders.push({ label: `${t.name} Repro`, typeId: t.id, field: 'reproductionThreshold', value: t.reproductionThreshold, min: 0, max: 300, step: 5 });
  }

  const sliderGroup = document.createElement('div');
  sliderGroup.className = 'slider-group';
  sliderGroup.id = 'slider-group';
  for (const s of sliders) {
    sliderGroup.appendChild(buildSlider(s));
  }
  hudEl.appendChild(sliderGroup);
}

function updateSliderValues() {
  // Called on config_changed to sync slider positions without rebuilding
  updateHUD();
}

const _debounceTimers = {};
function debounce(key, fn, ms = 250) {
  clearTimeout(_debounceTimers[key]);
  _debounceTimers[key] = setTimeout(fn, ms);
}

function buildSlider({ label, field, typeId, value, min, max, step }) {
  const row  = document.createElement('div');
  row.className = 'slider-row';
  const lbl  = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = value;
  lbl.appendChild(document.createTextNode(label + ' '));
  lbl.appendChild(span);

  const input = document.createElement('input');
  input.type  = 'range';
  input.min   = min;
  input.max   = max;
  input.step  = step;
  input.value = value;

  input.addEventListener('input', () => {
    span.textContent = input.value;
    const key = `${activeSlot}-${typeId || 'global'}-${field}`;
    debounce(key, () => {
      let overrides;
      if (typeId) {
        overrides = { agentTypes: [{ id: typeId, [field]: Number(input.value) }] };
      } else {
        overrides = { [field]: Number(input.value) };
      }
      fetch(`/api/instances/${activeSlot}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides),
      });
    });
  });

  row.appendChild(lbl);
  row.appendChild(input);
  return row;
}

// ── Universe gallery ──────────────────────────────────────────────────────────
async function refreshUniverseList() {
  const res = await fetch('/api/universes').catch(() => null);
  if (!res?.ok) return;
  const { templates, saved } = await res.json();

  universeListEl.innerHTML = '';

  const allTitle = document.createElement('div');
  allTitle.className = 'section-title';
  allTitle.textContent = 'Templates';
  universeListEl.appendChild(allTitle);

  for (const u of templates) {
    universeListEl.appendChild(buildUniverseCard(u, true));
  }

  if (saved.length > 0) {
    const savedTitle = document.createElement('div');
    savedTitle.className = 'section-title';
    savedTitle.style.marginTop = '10px';
    savedTitle.textContent = 'Saved';
    universeListEl.appendChild(savedTitle);
    for (const u of saved) {
      universeListEl.appendChild(buildUniverseCard(u, false));
    }
  }
}

function buildUniverseCard(u, isTemplate) {
  const card = document.createElement('div');
  card.className = 'universe-card' + (isTemplate ? ' template-badge' : '');

  const info = document.createElement('div');
  info.className = 'card-info';
  info.innerHTML = `<div class="card-name">${u.name}</div><div class="card-desc">${u.description || ''}</div>`;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  // Launch button
  const btnLaunch = document.createElement('button');
  btnLaunch.title = 'Launch in active slot';
  btnLaunch.textContent = '▶';
  btnLaunch.addEventListener('click', async e => {
    e.stopPropagation();
    const cfgRes = await fetch(`/api/universes/${u.id}`);
    const { universe } = await cfgRes.json();
    await launchInSlot(activeSlot, universe);
  });
  actions.appendChild(btnLaunch);

  // Edit button (not for templates)
  if (!isTemplate) {
    const btnEdit = document.createElement('button');
    btnEdit.title = 'Edit';
    btnEdit.textContent = '✎';
    btnEdit.addEventListener('click', async e => {
      e.stopPropagation();
      const cfgRes = await fetch(`/api/universes/${u.id}`);
      const { universe } = await cfgRes.json();
      creator.open(universe, activeSlot);
    });
    actions.appendChild(btnEdit);
  }

  // Clone button
  const btnClone = document.createElement('button');
  btnClone.title = 'Clone';
  btnClone.textContent = '⧉';
  btnClone.addEventListener('click', async e => {
    e.stopPropagation();
    await fetch(`/api/universes/${u.id}/clone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    refreshUniverseList();
  });
  actions.appendChild(btnClone);

  // Delete button (not for templates)
  if (!isTemplate) {
    const btnDel = document.createElement('button');
    btnDel.title = 'Delete';
    btnDel.textContent = '✕';
    btnDel.className = 'btn-danger';
    btnDel.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`Delete "${u.name}"?`)) return;
      await fetch(`/api/universes/${u.id}`, { method: 'DELETE' });
      refreshUniverseList();
    });
    actions.appendChild(btnDel);
  }

  card.appendChild(info);
  card.appendChild(actions);

  // Click card → launch in slot 1
  card.addEventListener('click', async () => {
    const cfgRes = await fetch(`/api/universes/${u.id}`);
    const { universe } = await cfgRes.json();
    await launchInSlot(activeSlot, universe);
  });

  return card;
}

// ── Init ──────────────────────────────────────────────────────────────────────
refreshUniverseList();
renderSlotCards();
