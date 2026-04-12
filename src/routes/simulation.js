'use strict';

const { Router } = require('express');
const engine = require('../simulation/engine');
const db = require('../db/database');

const router = Router();

// GET /api/state  — current in-memory state
router.get('/state', (req, res) => {
  res.json(engine.getState());
});

// GET /api/stats?from=0&limit=200  — historical tick-by-tick population counts
router.get('/stats', (req, res) => {
  const from = parseInt(req.query.from, 10) || 0;
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  res.json(db.getTickStats(from, limit));
});

// POST /api/simulation/start
router.post('/simulation/start', (req, res) => {
  engine.start();
  res.json({ status: 'started', tick: engine.tick });
});

// POST /api/simulation/stop
router.post('/simulation/stop', (req, res) => {
  engine.stop();
  res.json({ status: 'stopped', tick: engine.tick });
});

// POST /api/simulation/reset
router.post('/simulation/reset', (req, res) => {
  engine.reset();
  res.json({ status: 'reset', state: engine.getState() });
});

// POST /api/simulation/step  — advance exactly one tick (useful when stopped)
router.post('/simulation/step', (req, res) => {
  if (engine.running) {
    return res.status(409).json({ error: 'Stop the simulation before stepping manually.' });
  }
  engine.step();
  res.json(engine.getState());
});

// GET /api/snapshots
router.get('/snapshots', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  res.json(db.listSnapshots(limit));
});

// GET /api/snapshots/:id
router.get('/snapshots/:id', (req, res) => {
  const snapshot = db.getSnapshot(parseInt(req.params.id, 10));
  if (!snapshot) return res.status(404).json({ error: 'Snapshot not found.' });
  res.json(snapshot);
});

module.exports = router;
