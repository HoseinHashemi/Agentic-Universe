'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { TEMPLATES, validateUniverseConfig, mergeUniverseConfig } = require('../simulation/universeConfig');
const db = require('../db/database');

const router = express.Router();

// GET /api/universes — list saved universes + built-in templates
router.get('/universes', (req, res) => {
  const saved = db.listUniverses();
  const templates = Object.values(TEMPLATES).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isTemplate: true,
  }));
  res.json({ templates, saved });
});

// GET /api/universes/:id — get full config (template or saved)
router.get('/universes/:id', (req, res) => {
  const { id } = req.params;
  if (TEMPLATES[id]) return res.json({ universe: TEMPLATES[id], isTemplate: true });
  const u = db.getUniverse(id);
  if (!u) return res.status(404).json({ error: 'Universe not found.' });
  res.json({ universe: u.config, isTemplate: false });
});

// POST /api/universes — create/save a universe config
router.post('/universes', (req, res) => {
  const cfg = req.body;
  if (!cfg.id) cfg.id = 'u_' + uuidv4().slice(0, 8);
  const { valid, errors } = validateUniverseConfig(cfg);
  if (!valid) return res.status(400).json({ errors });
  const saved = db.saveUniverse(cfg);
  res.status(201).json({ universe: saved });
});

// PUT /api/universes/:id — full update
router.put('/universes/:id', (req, res) => {
  const { id } = req.params;
  if (TEMPLATES[id]) return res.status(403).json({ error: 'Cannot overwrite built-in templates.' });
  const existing = db.getUniverse(id);
  if (!existing) return res.status(404).json({ error: 'Universe not found.' });
  const cfg = { ...req.body, id };
  const { valid, errors } = validateUniverseConfig(cfg);
  if (!valid) return res.status(400).json({ errors });
  const saved = db.saveUniverse(cfg);
  res.json({ universe: saved });
});

// DELETE /api/universes/:id
router.delete('/universes/:id', (req, res) => {
  const { id } = req.params;
  if (TEMPLATES[id]) return res.status(403).json({ error: 'Cannot delete built-in templates.' });
  const ok = db.deleteUniverse(id);
  if (!ok) return res.status(404).json({ error: 'Universe not found.' });
  res.json({ ok: true });
});

// POST /api/universes/:id/clone — clone a template or saved universe
router.post('/universes/:id/clone', (req, res) => {
  const { id } = req.params;
  let base = TEMPLATES[id] ? { ...TEMPLATES[id] } : db.getUniverse(id)?.config;
  if (!base) return res.status(404).json({ error: 'Universe not found.' });

  const newId = 'u_' + uuidv4().slice(0, 8);
  const clone = {
    ...base,
    id: newId,
    name: (req.body?.name) || `${base.name} (copy)`,
    description: req.body?.description ?? base.description,
  };
  const saved = db.saveUniverse(clone);
  res.status(201).json({ universe: saved });
});

module.exports = router;
