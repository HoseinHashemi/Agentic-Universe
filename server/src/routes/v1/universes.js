'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { TEMPLATES, validateUniverseConfig } = require('../../simulation/universeConfig');
const db = require('../../db');
const { ADMIN_ID } = require('../../db/users');

const router = express.Router();

// GET /api/v1/universes — list saved universes + built-in templates
router.get('/', (req, res) => {
  const saved = db.listUniverses();
  const templates = Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isTemplate: true,
  }));
  res.json({ templates, saved });
});

// GET /api/v1/universes/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;
  if (TEMPLATES[id]) return res.json({ universe: TEMPLATES[id], isTemplate: true });
  const u = db.getUniverse(id);
  if (!u) return res.status(404).json({ error: 'Universe not found.' });
  res.json({ universe: u });
});

// POST /api/v1/universes — create universe
router.post('/', (req, res) => {
  const body = req.body;
  const config = body.config || body; // accept both wrapped and flat
  const { valid, errors } = validateUniverseConfig(config);
  if (!valid) return res.status(400).json({ errors });

  const u = db.saveUniverse({
    name: body.name || config.name,
    description: body.description || config.description || '',
    privacy: body.privacy || 'private',
    owner_id: ADMIN_ID,
    config,
  });
  res.status(201).json({ universe: u });
});

// PUT /api/v1/universes/:id — full update
router.put('/:id', (req, res) => {
  const { id } = req.params;
  if (TEMPLATES[id]) return res.status(403).json({ error: 'Cannot overwrite built-in templates.' });
  const existing = db.getUniverse(id);
  if (!existing) return res.status(404).json({ error: 'Universe not found.' });

  const body = req.body;
  const config = body.config || body;
  const { valid, errors } = validateUniverseConfig(config);
  if (!valid) return res.status(400).json({ errors });

  const u = db.saveUniverse({
    id,
    name: body.name || config.name,
    description: body.description || config.description || existing.description,
    privacy: body.privacy || existing.privacy,
    owner_id: existing.owner_id,
    config,
  });
  res.json({ universe: u });
});

// DELETE /api/v1/universes/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (TEMPLATES[id]) return res.status(403).json({ error: 'Cannot delete built-in templates.' });
  const ok = db.deleteUniverse(id);
  if (!ok) return res.status(404).json({ error: 'Universe not found.' });
  res.json({ ok: true });
});

// POST /api/v1/universes/:id/fork
router.post('/:id/fork', (req, res) => {
  const { id } = req.params;
  const { snapshotId, name, description } = req.body || {};

  let base;
  if (TEMPLATES[id]) {
    base = TEMPLATES[id];
  } else {
    const u = db.getUniverse(id);
    if (!u) return res.status(404).json({ error: 'Universe not found.' });
    base = u;
  }

  const baseConfig = base.config || base; // templates are flat

  if (snapshotId) {
    const snap = db.getSnapshot(snapshotId);
    if (!snap || snap.universe_id !== id) {
      return res.status(404).json({ error: 'Snapshot not found on this universe.' });
    }
  }

  const fork = db.saveUniverse({
    name: name || `${base.name || baseConfig.name} (fork)`,
    description: description ?? (base.description || ''),
    privacy: 'private',
    owner_id: ADMIN_ID,
    forked_from_id: id,
    forked_from_snapshot_id: snapshotId || null,
    config: baseConfig,
  });
  res.status(201).json({ universe: fork });
});

module.exports = router;
