'use strict';

const { EventEmitter } = require('events');
const { createAgent, updateAgent, spawnProducers } = require('./agents/agent');
const { mergeUniverseConfig } = require('./universeConfig');

const STATS_WINDOW_TICKS = 300; // rolling window for births/deaths rate

class SimulationEngine extends EventEmitter {
  constructor(instanceId, universeConfig) {
    super();
    this.instanceId  = instanceId;
    this.universeConfig = JSON.parse(JSON.stringify(universeConfig));
    this.agents      = new Map();
    this.tick        = 0;
    this.running     = false;
    this._timer      = null;

    // Birth/death history: Map<typeId, CircularBuffer>
    this._birthHistory = this._initHistory();
    this._deathHistory = this._initHistory();
    this._currentTick  = 0; // index within history window
  }

  _initHistory() {
    const h = new Map();
    for (const t of this.universeConfig.agentTypes) {
      h.set(t.id, new Array(STATS_WINDOW_TICKS).fill(0));
    }
    return h;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  initialize() {
    this.agents.clear();
    this.tick = 0;
    this._currentTick = 0;
    this._birthHistory = this._initHistory();
    this._deathHistory = this._initHistory();

    const { worldWidth, worldHeight, agentTypes } = this.universeConfig;
    for (const typeCfg of agentTypes) {
      for (let i = 0; i < (typeCfg.initialCount || 0); i++) {
        this._addAgent(createAgent(
          typeCfg.id,
          Math.random() * worldWidth,
          Math.random() * worldHeight,
          typeCfg,
        ));
      }
    }
    this.emit('initialized', this.getState());
  }

  start() {
    if (this.running) return;
    if (this.tick === 0) this.initialize();
    this.running = true;
    this._timer = setInterval(() => this.step(), this.universeConfig.tickInterval || 200);
    this.emit('started');
  }

  stop() {
    if (!this.running) return;
    clearInterval(this._timer);
    this._timer = null;
    this.running = false;
    this.emit('stopped');
  }

  reset() {
    this.stop();
    this.initialize();
    this.emit('reset', this.getState());
  }

  // ── Runtime config updates ──────────────────────────────────────────────────

  updateRuntimeConfig(overrides) {
    const prevInterval = this.universeConfig.tickInterval;
    this.universeConfig = mergeUniverseConfig(this.universeConfig, overrides);
    if (this.running && this.universeConfig.tickInterval !== prevInterval) {
      clearInterval(this._timer);
      this._timer = setInterval(() => this.step(), this.universeConfig.tickInterval);
    }
    this.emit('config_changed', this.universeConfig);
    return this.universeConfig;
  }

  getUniverseConfig() { return this.universeConfig; }

  // ── Core step ───────────────────────────────────────────────────────────────

  step() {
    this.tick++;
    const pending  = [];
    const events   = [];
    const births   = new Map(); // typeId → count this tick
    const deaths   = new Map(); // typeId → count this tick

    for (const t of this.universeConfig.agentTypes) {
      births.set(t.id, 0);
      deaths.set(t.id, 0);
    }

    // 1. Spawn producers
    const newProducers = spawnProducers(this.agents, this.universeConfig);
    for (const a of newProducers) {
      pending.push(a);
      births.set(a.typeId, (births.get(a.typeId) || 0) + 1);
    }

    // 2. Update non-producers (snapshot prevents processing newly-spawned agents)
    const nonProducerSnap = [...this.agents.values()].filter(a => {
      const cfg = this._getTypeCfg(a.typeId);
      return cfg && cfg.role !== 'producer' && a.alive;
    });

    for (const agent of nonProducerSnap) {
      const typeCfg = this._getTypeCfg(agent.typeId);
      if (!typeCfg) continue;
      const offspring = updateAgent(agent, typeCfg, this.agents, this.universeConfig, events);
      for (const child of offspring) {
        pending.push(child);
        births.set(child.typeId, (births.get(child.typeId) || 0) + 1);
      }
    }

    // 3. Age producers
    for (const agent of this.agents.values()) {
      const cfg = this._getTypeCfg(agent.typeId);
      if (cfg?.role === 'producer' && agent.alive) agent.age++;
    }

    // 4. Collect die events and purge dead agents
    for (const [id, agent] of this.agents) {
      if (!agent.alive) {
        const cfg = this._getTypeCfg(agent.typeId);
        events.push({ type: 'die', agentType: agent.typeId, color: cfg?.color || '#ffffff', x: agent.x, y: agent.y });
        deaths.set(agent.typeId, (deaths.get(agent.typeId) || 0) + 1);
        this.agents.delete(id);
      }
    }

    // 5. Register new agents
    for (const agent of pending) this._addAgent(agent);

    // 6. Update rolling birth/death history
    const slot = this._currentTick % STATS_WINDOW_TICKS;
    for (const [typeId, count] of births) {
      const arr = this._birthHistory.get(typeId);
      if (arr) arr[slot] = count;
    }
    for (const [typeId, count] of deaths) {
      const arr = this._deathHistory.get(typeId);
      if (arr) arr[slot] = count;
    }
    this._currentTick++;

    // 7. Emit
    const state = this.getState();
    this.emit('tick', { ...state, events });
    if (this.tick % (this.universeConfig.snapshotInterval || 50) === 0) {
      this.emit('snapshot', { tick: this.tick, state });
    }
  }

  // ── State ────────────────────────────────────────────────────────────────────

  getState() {
    const agents = [...this.agents.values()].map(a => ({
      id: a.id, typeId: a.typeId, role: a.role,
      x: Math.round(a.x * 10) / 10,
      y: Math.round(a.y * 10) / 10,
      energy: Math.round(a.energy * 10) / 10,
      age: a.age, state: a.state,
    }));

    return {
      instanceId: this.instanceId,
      tick: this.tick,
      running: this.running,
      agents,
      stats: this._computeStats(),
      universeConfig: this.universeConfig,
    };
  }

  _computeStats() {
    const ticksPerMin = 60000 / (this.universeConfig.tickInterval || 200);
    const window = Math.min(this._currentTick, STATS_WINDOW_TICKS);
    const ratio = window > 0 ? ticksPerMin / window : 0;

    const stats = [];
    for (const typeCfg of this.universeConfig.agentTypes) {
      let count = 0, totalEnergy = 0;
      for (const agent of this.agents.values()) {
        if (agent.typeId === typeCfg.id) { count++; totalEnergy += agent.energy; }
      }
      const bArr = this._birthHistory.get(typeCfg.id) || [];
      const dArr = this._deathHistory.get(typeCfg.id) || [];
      const births = bArr.slice(0, window).reduce((s, v) => s + v, 0);
      const dths   = dArr.slice(0, window).reduce((s, v) => s + v, 0);

      stats.push({
        typeId: typeCfg.id,
        name: typeCfg.name,
        color: typeCfg.color,
        role: typeCfg.role,
        count,
        avgEnergy: count > 0 ? Math.round(totalEnergy / count) : 0,
        birthsPerMin: Math.round(births * ratio),
        deathsPerMin: Math.round(dths   * ratio),
      });
    }
    return stats;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _getTypeCfg(typeId) {
    return this.universeConfig.agentTypes.find(t => t.id === typeId);
  }

  _addAgent(agent) { this.agents.set(agent.id, agent); }
}

module.exports = SimulationEngine;
