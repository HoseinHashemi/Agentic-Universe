/**
 * Universe Creator/Editor modal.
 * Usage:
 *   const creator = new UniverseCreator(document.getElementById('creator-modal'));
 *   creator.open(existingConfig);  // pass null to create new
 *   creator.onSave = async (cfg) => { ... };
 */

const ROLE_LABELS = { producer: 'Producer', consumer: 'Consumer', predator: 'Predator' };

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'style') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

function inputRow(label, name, type, value, opts = {}) {
  const inp = el('input', { type, name, value: String(value ?? ''), ...(opts.step ? { step: opts.step } : {}), ...(opts.min != null ? { min: opts.min } : {}), ...(opts.max != null ? { max: opts.max } : {}) });
  const fg = el('div', { className: 'form-group' },
    el('label', {}, label),
    inp,
  );
  return { fg, inp };
}

export class UniverseCreator {
  constructor(backdropEl) {
    this._backdrop = backdropEl;
    this._cfg = null;
    this._targetSlot = null;
    this.onSave = null; // callback(cfg, slot)
    this._backdrop.addEventListener('click', e => {
      if (e.target === this._backdrop) this.close();
    });
    this._backdrop.querySelector('.modal-close')?.addEventListener('click', () => this.close());
    this._backdrop.querySelector('#btn-save-universe')?.addEventListener('click', () => this._save());
    this._backdrop.querySelector('#btn-cancel-creator')?.addEventListener('click', () => this.close());
    this._backdrop.querySelector('#btn-add-agent-type')?.addEventListener('click', () => this._addAgentType());

    this._form      = this._backdrop.querySelector('#creator-form');
    this._typesContainer = this._backdrop.querySelector('#agent-types-container');
    this._bannerEl  = this._backdrop.querySelector('#creator-banner');
    this._slotSelect = this._backdrop.querySelector('#launch-slot-select');
  }

  open(cfg, targetSlot = 1) {
    this._targetSlot = targetSlot;
    this._cfg = cfg ? JSON.parse(JSON.stringify(cfg)) : this._blank();
    this._render();
    this._backdrop.classList.remove('hidden');
  }

  close() {
    this._backdrop.classList.add('hidden');
  }

  _blank() {
    return {
      name: 'My Universe',
      description: '',
      worldWidth: 800,
      worldHeight: 600,
      tickInterval: 200,
      snapshotInterval: 50,
      agentTypes: [
        { id: 'plant',     name: 'Plants',      color: '#4dff91', role: 'producer',
          initialCount: 50, maxCount: 120, initialEnergy: 0, maxEnergy: 0,
          energyDecayRate: 0, energyValue: 30, speed: 0, visionRange: 0, eatRange: 0,
          wanderTurnRate: 0, reproductionThreshold: 0, reproductionCost: 0,
          reproductionCooldown: 0, offspringEnergyRatio: 0.5, maxLifespan: 0,
          spawnRate: 0.15, clusterBias: 0.65, clusterRadius: 60, eats: [] },
        { id: 'herbivore', name: 'Herbivores',  color: '#5aadff', role: 'consumer',
          initialCount: 20, maxCount: 150, initialEnergy: 80, maxEnergy: 150,
          energyDecayRate: 1, energyValue: 40, speed: 2.5, visionRange: 100, eatRange: 10,
          wanderTurnRate: 0.25, reproductionThreshold: 120, reproductionCost: 50,
          reproductionCooldown: 40, offspringEnergyRatio: 0.5, maxLifespan: 500,
          spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: ['plant'] },
      ],
    };
  }

  _render() {
    // Universe meta
    this._form.querySelector('[name=universe-name]').value        = this._cfg.name || '';
    this._form.querySelector('[name=universe-description]').value = this._cfg.description || '';
    this._form.querySelector('[name=worldWidth]').value           = this._cfg.worldWidth  || 800;
    this._form.querySelector('[name=worldHeight]').value          = this._cfg.worldHeight || 600;
    this._form.querySelector('[name=tickInterval]').value         = this._cfg.tickInterval || 200;

    if (this._slotSelect) this._slotSelect.value = String(this._targetSlot);

    this._typesContainer.innerHTML = '';
    for (const t of (this._cfg.agentTypes || [])) {
      this._typesContainer.appendChild(this._buildTypeCard(t));
    }
    this._hideBanner();
  }

  _buildTypeCard(t) {
    const allTypeIds = (this._cfg.agentTypes || []).map(x => x.id);

    const card = el('div', { className: 'agent-type-card', 'data-type-id': t.id });

    // Header
    const dot = el('span', { className: 'type-dot', style: { background: t.color || '#fff' } });
    const nameInp = el('input', { type: 'text', name: 'type-name', value: t.name, style: { background: 'none', border: 'none', color: 'var(--text)', fontWeight: '700', fontSize: '13px', flex: '1', outline: 'none' } });
    const colorInp = el('input', { type: 'color', name: 'type-color', value: t.color || '#ffffff' });
    colorInp.addEventListener('input', () => { dot.style.background = colorInp.value; });

    const roleSelect = el('select', { name: 'type-role', style: { background: 'var(--panel2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: '4px', fontSize: '11px' } });
    for (const [v, label] of Object.entries(ROLE_LABELS)) {
      const opt = el('option', { value: v }, label);
      if (v === t.role) opt.selected = true;
      roleSelect.appendChild(opt);
    }

    const removeBtn = el('button', { className: 'btn btn-sm btn-danger btn-remove' }, '✕');
    removeBtn.addEventListener('click', () => {
      this._cfg.agentTypes = this._cfg.agentTypes.filter(x => x.id !== t.id);
      card.remove();
      this._refreshEatsCheckboxes();
    });

    const header = el('div', { className: 'agent-type-header' }, dot, colorInp, nameInp, roleSelect, removeBtn);
    card.appendChild(header);

    // Params grid
    const params = [
      ['Initial Count', 'initialCount', t.initialCount, 0, 500, 1],
      ['Max Count',     'maxCount',     t.maxCount,     0, 999, 1],
      ['Initial Energy','initialEnergy',t.initialEnergy,0, 999, 1],
      ['Max Energy',    'maxEnergy',    t.maxEnergy,    0, 999, 1],
      ['Energy Decay',  'energyDecayRate', t.energyDecayRate, 0, 20, 0.1],
      ['Energy Value',  'energyValue',  t.energyValue,  0, 200, 1],
      ['Speed',         'speed',        t.speed,        0, 20,  0.1],
      ['Vision Range',  'visionRange',  t.visionRange,  0, 400, 1],
      ['Eat Range',     'eatRange',     t.eatRange,     0, 50,  1],
      ['Repro Threshold','reproductionThreshold', t.reproductionThreshold, 0, 999, 1],
      ['Repro Cost',    'reproductionCost',       t.reproductionCost,      0, 999, 1],
      ['Repro Cooldown','reproductionCooldown',   t.reproductionCooldown,  0, 300, 1],
      ['Max Lifespan',  'maxLifespan',  t.maxLifespan,  0, 9999,1],
      ['Spawn Rate',    'spawnRate',    t.spawnRate,    0, 1,   0.01],
      ['Cluster Bias',  'clusterBias',  t.clusterBias,  0, 1,   0.01],
    ];

    const grid = el('div', { className: 'agent-type-params' });
    for (const [label, field, val, min, max, step] of params) {
      const inp = el('input', { type: 'number', name: `param-${field}`, value: val, min, max, step });
      const fg = el('div', { className: 'form-group' }, el('label', {}, label), inp);
      grid.appendChild(fg);
    }
    card.appendChild(grid);

    // Eats section
    const eatsSection = el('div', { className: 'eats-section', 'data-role': 'eats-section' });
    const eatsLabel = el('label', {}, 'Eats:');
    const eatsBoxes = el('div', { className: 'eats-checkboxes', 'data-role': 'eats-checkboxes' });
    for (const otherId of allTypeIds) {
      if (otherId === t.id) continue;
      const other = this._cfg.agentTypes.find(x => x.id === otherId);
      if (!other) continue;
      const cb = el('input', { type: 'checkbox', value: otherId, name: `eats-${otherId}` });
      if ((t.eats || []).includes(otherId)) cb.checked = true;
      const cbLabel = el('label', {}, cb, ` ${other.name}`);
      eatsBoxes.appendChild(cbLabel);
    }
    eatsSection.appendChild(eatsLabel);
    eatsSection.appendChild(eatsBoxes);
    card.appendChild(eatsSection);

    return card;
  }

  _refreshEatsCheckboxes() {
    // Rebuild eats sections when types are added/removed
    for (const card of this._typesContainer.querySelectorAll('.agent-type-card')) {
      const typeId = card.dataset.typeId;
      const t = this._cfg.agentTypes.find(x => x.id === typeId);
      if (!t) continue;
      const eatsSection = card.querySelector('[data-role=eats-section]');
      const eatsBoxes   = card.querySelector('[data-role=eats-checkboxes]');
      if (!eatsBoxes) continue;
      eatsBoxes.innerHTML = '';
      for (const other of this._cfg.agentTypes) {
        if (other.id === typeId) continue;
        const cb = el('input', { type: 'checkbox', value: other.id, name: `eats-${other.id}` });
        if ((t.eats || []).includes(other.id)) cb.checked = true;
        eatsBoxes.appendChild(el('label', {}, cb, ` ${other.name}`));
      }
    }
  }

  _addAgentType() {
    const roleSelect = this._backdrop.querySelector('#new-agent-role');
    const role = roleSelect?.value || 'consumer';
    const id = 'type_' + Math.random().toString(36).slice(2, 10);
    const defaults = {
      producer: { name: 'Plants', color: '#4dff91', initialCount: 50, maxCount: 120, initialEnergy: 0, maxEnergy: 0, energyDecayRate: 0, energyValue: 30, speed: 0, visionRange: 0, eatRange: 0, wanderTurnRate: 0, reproductionThreshold: 0, reproductionCost: 0, reproductionCooldown: 0, offspringEnergyRatio: 0.5, maxLifespan: 0, spawnRate: 0.15, clusterBias: 0.65, clusterRadius: 60, eats: [] },
      consumer: { name: 'Consumer', color: '#5aadff', initialCount: 20, maxCount: 150, initialEnergy: 80, maxEnergy: 150, energyDecayRate: 1, energyValue: 40, speed: 2.5, visionRange: 100, eatRange: 10, wanderTurnRate: 0.25, reproductionThreshold: 120, reproductionCost: 50, reproductionCooldown: 40, offspringEnergyRatio: 0.5, maxLifespan: 500, spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: [] },
      predator: { name: 'Predator', color: '#ff6b35', initialCount: 5,  maxCount: 50,  initialEnergy: 100, maxEnergy: 200, energyDecayRate: 1.5, energyValue: 60, speed: 3.5, visionRange: 150, eatRange: 12, wanderTurnRate: 0.2, reproductionThreshold: 160, reproductionCost: 70, reproductionCooldown: 60, offspringEnergyRatio: 0.5, maxLifespan: 600, spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: [] },
    };
    const t = { id, role, ...defaults[role] };
    this._cfg.agentTypes.push(t);
    this._typesContainer.appendChild(this._buildTypeCard(t));
    this._refreshEatsCheckboxes();
  }

  _readForm() {
    const f = this._form;
    const cfg = {
      name:             f.querySelector('[name=universe-name]').value.trim(),
      description:      f.querySelector('[name=universe-description]').value.trim(),
      worldWidth:       Number(f.querySelector('[name=worldWidth]').value),
      worldHeight:      Number(f.querySelector('[name=worldHeight]').value),
      tickInterval:     Number(f.querySelector('[name=tickInterval]').value),
      snapshotInterval: 50,
      agentTypes: [],
    };

    for (const card of this._typesContainer.querySelectorAll('.agent-type-card')) {
      const typeId = card.dataset.typeId;
      const n = v => card.querySelector(`[name="param-${v}"]`)?.value;
      const eats = [...card.querySelectorAll('[name^=eats-]:checked')].map(cb => cb.value);
      cfg.agentTypes.push({
        id: typeId,
        name:  card.querySelector('[name=type-name]').value.trim(),
        color: card.querySelector('[name=type-color]').value,
        role:  card.querySelector('[name=type-role]').value,
        initialCount:          Number(n('initialCount')),
        maxCount:              Number(n('maxCount')),
        initialEnergy:         Number(n('initialEnergy')),
        maxEnergy:             Number(n('maxEnergy')),
        energyDecayRate:       Number(n('energyDecayRate')),
        energyValue:           Number(n('energyValue')),
        speed:                 Number(n('speed')),
        visionRange:           Number(n('visionRange')),
        eatRange:              Number(n('eatRange')),
        reproductionThreshold: Number(n('reproductionThreshold')),
        reproductionCost:      Number(n('reproductionCost')),
        reproductionCooldown:  Number(n('reproductionCooldown')),
        maxLifespan:           Number(n('maxLifespan')),
        spawnRate:             Number(n('spawnRate')),
        clusterBias:           Number(n('clusterBias')),
        offspringEnergyRatio:  0.5,
        wanderTurnRate:        0.2,
        clusterRadius:         60,
        eats,
      });
    }
    return cfg;
  }

  async _save() {
    const cfg = this._readForm();
    const slot = this._slotSelect ? Number(this._slotSelect.value) : this._targetSlot;

    this._hideBanner();
    try {
      if (this.onSave) await this.onSave(cfg, slot);
      this.close();
    } catch (err) {
      this._showBanner(err.message || 'Failed to save.', 'error');
    }
  }

  _showBanner(msg, type = 'error') {
    if (!this._bannerEl) return;
    this._bannerEl.textContent = msg;
    this._bannerEl.className = `banner ${type}`;
    this._bannerEl.style.display = 'block';
  }

  _hideBanner() {
    if (!this._bannerEl) return;
    this._bannerEl.style.display = 'none';
  }
}
