'use strict';

const express = require('express');
const im = require('../../simulation/instanceManager');
const { TEMPLATES } = require('../../simulation/universeConfig');
const db = require('../../db');

const router = express.Router();

// In-memory map: instanceId (slot-N) → universeId
// Populated when instances are created; persists only for the process lifetime.
const _instanceUniverse = new Map();

function getUniverseId(instanceId) {
  return _instanceUniverse.get(instanceId) || null;
}

function registerInstance(instanceId, universeId) {
  _instanceUniverse.set(instanceId, universeId);
}

function unregisterInstance(instanceId) {
  _instanceUniverse.delete(instanceId);
}

// GET /api/v1/instances
router.get('/', (req, res) => {
  const list = im.getAllInstances().map(({ slot, engine }) => ({
    id: engine.instanceId,
    slot,
    universeId: getUniverseId(engine.instanceId),
    ...engine.getState(),
  }));
  res.json({ instances: list });
});

// POST /api/v1/instances — create instance
// body: { universeId, slot }
router.post('/', (req, res) => {
  const { universeId, slot: rawSlot } = req.body || {};
  const slot = parseInt(rawSlot, 10);

  if (!universeId) return res.status(400).json({ error: 'universeId is required.' });
  if (isNaN(slot) || slot < 1 || slot > im.MAX_SLOTS) {
    return res.status(400).json({ error: `slot must be 1–${im.MAX_SLOTS}` });
  }

  let config;
  if (TEMPLATES[universeId]) {
    config = TEMPLATES[universeId];
  } else {
    const u = db.getUniverse(universeId);
    if (!u) return res.status(404).json({ error: 'Universe not found.' });
    config = u.config;

    // If this universe was forked from a snapshot, load that agent state
    if (u.forked_from_snapshot_id) {
      const snap = db.getSnapshot(u.forked_from_snapshot_id);
      if (snap?.state?.agents) {
        const engine = im.createInstance(slot, config);
        registerInstance(engine.instanceId, universeId);
        // Inject snapshot agents into the initialized engine
        engine.agents.clear();
        engine.tick = 0;
        for (const agentData of snap.state.agents) {
          engine.agents.set(agentData.id, { ...agentData, alive: true });
        }
        return res.status(201).json({ id: engine.instanceId, slot, state: engine.getState() });
      }
    }
  }

  const engine = im.createInstance(slot, config);
  registerInstance(engine.instanceId, universeId);
  res.status(201).json({ id: engine.instanceId, slot, state: engine.getState() });
});

// DELETE /api/v1/instances/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params; // e.g. "slot-1"
  const slot = _slotFromId(id);
  if (!slot) return res.status(404).json({ error: 'Instance not found.' });
  const ok = im.destroyInstance(slot);
  if (!ok) return res.status(404).json({ error: 'Instance not found.' });
  unregisterInstance(id);
  res.json({ ok: true });
});

// POST /api/v1/instances/:id/start
router.post('/:id/start', (req, res) => {
  const engine = _getEngine(req.params.id);
  if (!engine) return res.status(404).json({ error: 'Instance not found.' });
  engine.start();
  res.json({ ok: true, tick: engine.tick });
});

// POST /api/v1/instances/:id/stop
router.post('/:id/stop', (req, res) => {
  const engine = _getEngine(req.params.id);
  if (!engine) return res.status(404).json({ error: 'Instance not found.' });
  engine.stop();
  res.json({ ok: true, tick: engine.tick });
});

// POST /api/v1/instances/:id/reset
router.post('/:id/reset', (req, res) => {
  const engine = _getEngine(req.params.id);
  if (!engine) return res.status(404).json({ error: 'Instance not found.' });
  engine.reset();
  res.json({ ok: true, state: engine.getState() });
});

// PATCH /api/v1/instances/:id/config
router.patch('/:id/config', (req, res) => {
  const engine = _getEngine(req.params.id);
  if (!engine) return res.status(404).json({ error: 'Instance not found.' });
  const updated = engine.updateRuntimeConfig(req.body);
  res.json({ config: updated });
});

// GET /api/v1/instances/:id/state
router.get('/:id/state', (req, res) => {
  const engine = _getEngine(req.params.id);
  if (!engine) return res.status(404).json({ error: 'Instance not found.' });
  res.json(engine.getState());
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function _slotFromId(instanceId) {
  const m = instanceId.match(/^slot-(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function _getEngine(instanceId) {
  const slot = _slotFromId(instanceId);
  return slot ? im.getInstance(slot) : null;
}

module.exports = router;
module.exports.registerInstance = registerInstance;
module.exports.getUniverseId = getUniverseId;
