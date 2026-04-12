'use strict';

const express = require('express');
const im = require('../simulation/instanceManager');
const { TEMPLATES } = require('../simulation/universeConfig');
const db = require('../db/database');

const router = express.Router();

// ── Helper ────────────────────────────────────────────────────────────────────

function resolveConfig(body) {
  // body may contain universeId (template/saved) or full universeConfig object
  if (body.universeId) {
    const cfg = TEMPLATES[body.universeId]
      ? TEMPLATES[body.universeId]
      : db.getUniverse(body.universeId)?.config;
    if (!cfg) return { err: `Universe "${body.universeId}" not found.` };
    return { cfg };
  }
  if (body.universeConfig) return { cfg: body.universeConfig };
  return { err: 'Provide universeId or universeConfig.' };
}

// ── Instances ─────────────────────────────────────────────────────────────────

// GET /api/instances
router.get('/instances', (req, res) => {
  const list = im.getAllInstances().map(({ slot, engine }) => ({
    slot,
    ...engine.getState(),
  }));
  res.json({ instances: list });
});

// POST /api/instances/:slot — create/replace an instance in a slot
router.post('/instances/:slot', (req, res) => {
  const slot = parseInt(req.params.slot, 10);
  if (isNaN(slot) || slot < 1 || slot > im.MAX_SLOTS)
    return res.status(400).json({ error: `slot must be 1–${im.MAX_SLOTS}` });

  const { cfg, err } = resolveConfig(req.body);
  if (err) return res.status(400).json({ error: err });

  const engine = im.createInstance(slot, cfg);
  res.status(201).json({ slot, state: engine.getState() });
});

// DELETE /api/instances/:slot
router.delete('/instances/:slot', (req, res) => {
  const slot = parseInt(req.params.slot, 10);
  const ok = im.destroyInstance(slot);
  if (!ok) return res.status(404).json({ error: 'No instance at that slot.' });
  res.json({ ok: true });
});

// POST /api/instances/:slot/start
router.post('/instances/:slot/start', (req, res) => {
  const engine = im.getInstance(parseInt(req.params.slot, 10));
  if (!engine) return res.status(404).json({ error: 'No instance at that slot.' });
  engine.start();
  res.json({ ok: true, tick: engine.tick });
});

// POST /api/instances/:slot/stop
router.post('/instances/:slot/stop', (req, res) => {
  const engine = im.getInstance(parseInt(req.params.slot, 10));
  if (!engine) return res.status(404).json({ error: 'No instance at that slot.' });
  engine.stop();
  res.json({ ok: true, tick: engine.tick });
});

// POST /api/instances/:slot/reset
router.post('/instances/:slot/reset', (req, res) => {
  const engine = im.getInstance(parseInt(req.params.slot, 10));
  if (!engine) return res.status(404).json({ error: 'No instance at that slot.' });
  engine.reset();
  res.json({ ok: true, state: engine.getState() });
});

// GET /api/instances/:slot/state
router.get('/instances/:slot/state', (req, res) => {
  const engine = im.getInstance(parseInt(req.params.slot, 10));
  if (!engine) return res.status(404).json({ error: 'No instance at that slot.' });
  res.json(engine.getState());
});

// PATCH /api/instances/:slot/config
router.patch('/instances/:slot/config', (req, res) => {
  const engine = im.getInstance(parseInt(req.params.slot, 10));
  if (!engine) return res.status(404).json({ error: 'No instance at that slot.' });
  const updated = engine.updateRuntimeConfig(req.body);
  res.json({ config: updated });
});

module.exports = router;
