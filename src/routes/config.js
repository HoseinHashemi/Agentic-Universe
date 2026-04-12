'use strict';

const { Router } = require('express');
const engine = require('../simulation/engine');
const db = require('../db/database');

const router = Router();

// GET /api/config
router.get('/config', (req, res) => {
  res.json(engine.getConfig());
});

// PATCH /api/config  — deep-merge provided fields into current config
router.patch('/config', (req, res) => {
  const overrides = req.body;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return res.status(400).json({ error: 'Body must be a JSON object.' });
  }
  const updated = engine.updateConfig(overrides);
  db.saveConfig(updated);
  res.json(updated);
});

// PUT /api/config  — replace config entirely (merged with defaults for safety)
router.put('/config', (req, res) => {
  const overrides = req.body;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return res.status(400).json({ error: 'Body must be a JSON object.' });
  }
  const updated = engine.updateConfig(overrides);
  db.saveConfig(updated);
  res.json(updated);
});

module.exports = router;
