'use strict';

const { Router } = require('express');
const db = require('../../db');
const sessionMgr = require('../../orchestrator/sessionManager');

const router = Router({ mergeParams: true });

// GET /api/v1/universes/:id/session
router.get('/', (req, res) => {
  const sess = db.getActiveSession(req.params.id);
  const running = sessionMgr.isRunning(req.params.id);
  res.json({ session: sess, running });
});

// POST /api/v1/universes/:id/session
router.post('/', (req, res) => {
  const universe = db.getUniverse(req.params.id);
  if (!universe) return res.status(404).json({ error: 'Universe not found.' });

  if (sessionMgr.isRunning(req.params.id)) {
    return res.status(409).json({ error: 'Session already running.' });
  }
  const sess = db.createSession(req.params.id);
  sessionMgr.startSession(req.params.id, sess.id);
  res.status(201).json({ session: sess });
});

// DELETE /api/v1/universes/:id/session
router.delete('/', (req, res) => {
  const sess = db.getActiveSession(req.params.id);
  if (sess) db.stopSession(sess.id);
  sessionMgr.stopSession(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
