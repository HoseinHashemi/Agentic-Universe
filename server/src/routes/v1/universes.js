'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db');
const { ADMIN_ID } = require('../../db/users');

const router = express.Router();

// GET /api/v1/universes — list saved universes
router.get('/', (req, res) => {
  const saved = db.listUniverses();
  res.json({ saved });
});

// GET /api/v1/universes/:id
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const u = db.getUniverse(id);
  if (!u) return res.status(404).json({ error: 'Universe not found.' });
  res.json({ universe: u });
});

// POST /api/v1/universes — create universe
router.post('/', (req, res) => {
  const body = req.body;
  const config = body.config || body;

  const u = db.saveUniverse({
    name: body.name || config.name || 'Untitled',
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
  const existing = db.getUniverse(id);
  if (!existing) return res.status(404).json({ error: 'Universe not found.' });

  const body = req.body;
  const config = body.config || body;

  const u = db.saveUniverse({
    id,
    name: body.name || config.name || 'Untitled',
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
  const ok = db.deleteUniverse(id);
  if (!ok) return res.status(404).json({ error: 'Universe not found.' });
  res.json({ ok: true });
});

// POST /api/v1/universes/:id/fork
router.post('/:id/fork', (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body || {};

  const base = db.getUniverse(id);
  if (!base) return res.status(404).json({ error: 'Universe not found.' });

  const baseConfig = base.config || base;

  const fork = db.saveUniverse({
    name: name || `${base.name} (fork)`,
    description: description ?? (base.description || ''),
    privacy: 'private',
    owner_id: ADMIN_ID,
    forked_from_id: id,
    config: baseConfig,
  });
  res.status(201).json({ universe: fork });
});

module.exports = router;
