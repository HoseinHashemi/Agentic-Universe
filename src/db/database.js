'use strict';

/**
 * JSON-file persistence layer (no native dependencies).
 * File: ./universe-data.json
 *
 * Schema:
 * {
 *   schemaVersion: 2,
 *   universes: { [id]: { id, name, description, createdAt, updatedAt, config } },
 *   snapshots: [ { id, tick, instanceId, ts, state } ],
 *   tickStats: [ { tick, ts, instanceId, stats[] } ]
 * }
 */

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_PATH     = path.join(__dirname, '../../universe-data.json');
const MAX_SNAPSHOTS = 200;
const MAX_TICK_STATS = 2000;

let store = {
  schemaVersion: 2,
  universes: {},
  snapshots: [],
  tickStats: [],
  nextSnapshotId: 1,
};

function _load() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      // Migrate v1 → v2
      if (!parsed.schemaVersion || parsed.schemaVersion < 2) {
        store.schemaVersion = 2;
        store.universes = {};
        // keep snapshots/tickStats if present
        if (Array.isArray(parsed.snapshots)) store.snapshots = parsed.snapshots;
        if (Array.isArray(parsed.tickStats)) store.tickStats = parsed.tickStats;
        if (parsed.nextSnapshotId) store.nextSnapshotId = parsed.nextSnapshotId;
      } else {
        store = { ...store, ...parsed };
      }
    }
  } catch (err) {
    console.warn('[db] could not load data file:', err.message);
  }
}

let _persistTimer = null;
function _persist() {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    fs.writeFile(DATA_PATH, JSON.stringify(store, null, 2), err => {
      if (err) console.error('[db] write error:', err.message);
    });
  }, 500); // debounced writes
}

_load();

// ── Universe CRUD ─────────────────────────────────────────────────────────────

function saveUniverse(universeConfig) {
  const now = Date.now();
  const id = universeConfig.id || 'u_' + uuidv4().slice(0, 8);
  const existing = store.universes[id];
  store.universes[id] = {
    id,
    name: universeConfig.name || 'Unnamed',
    description: universeConfig.description || '',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    config: { ...universeConfig, id },
  };
  _persist();
  return store.universes[id];
}

function getUniverse(id) {
  return store.universes[id] || null;
}

function listUniverses() {
  return Object.values(store.universes).map(({ id, name, description, createdAt, updatedAt }) => ({
    id, name, description, createdAt, updatedAt,
  }));
}

function deleteUniverse(id) {
  if (!store.universes[id]) return false;
  delete store.universes[id];
  _persist();
  return true;
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

function saveSnapshot(tick, state, instanceId = 'default') {
  const id = store.nextSnapshotId++;
  store.snapshots.unshift({ id, tick, instanceId, ts: Date.now(), state });
  if (store.snapshots.length > MAX_SNAPSHOTS) store.snapshots.length = MAX_SNAPSHOTS;
  _persist();
}

function listSnapshots(instanceId, limit = 20) {
  const filtered = instanceId
    ? store.snapshots.filter(s => s.instanceId === instanceId)
    : store.snapshots;
  return filtered.slice(0, limit).map(({ id, tick, instanceId: iid, ts }) => ({ id, tick, instanceId: iid, ts }));
}

function getSnapshot(id) {
  return store.snapshots.find(s => s.id === id) || null;
}

// ── Tick stats ────────────────────────────────────────────────────────────────

function saveTickStats(tick, stats, instanceId = 'default') {
  store.tickStats.push({ tick, ts: Date.now(), instanceId, stats });
  if (store.tickStats.length > MAX_TICK_STATS) {
    store.tickStats.splice(0, store.tickStats.length - MAX_TICK_STATS);
  }
  if (tick % 10 === 0) _persist();
}

function getTickStats(instanceId, fromTick = 0, limit = 200) {
  return store.tickStats
    .filter(s => s.instanceId === instanceId && s.tick >= fromTick)
    .slice(-limit);
}

module.exports = {
  saveUniverse, getUniverse, listUniverses, deleteUniverse,
  saveSnapshot, listSnapshots, getSnapshot,
  saveTickStats, getTickStats,
};
