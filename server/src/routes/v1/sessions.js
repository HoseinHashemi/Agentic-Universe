'use strict';

const { Router } = require('express');
const db = require('../../db');
const sessionMgr = require('../../orchestrator/sessionManager');

const router = Router({ mergeParams: true });

// GET /api/v1/universes/:id/session
router.get('/', (req, res) => {
  const sess    = db.getActiveSession(req.params.id);
  const status  = sessionMgr.getStatus(req.params.id);
  res.json({ session: sess, status });
});

// POST /api/v1/universes/:id/session  — start
router.post('/', (req, res) => {
  const universe = db.getUniverse(req.params.id);
  if (!universe) return res.status(404).json({ error: 'Universe not found.' });

  if (sessionMgr.isRunning(req.params.id)) {
    return res.status(409).json({ error: 'Session already running.' });
  }
  const sess = db.createSession(req.params.id);
  sessionMgr.startSession(req.params.id, sess.id);
  res.status(201).json({ session: sess, status: 'running' });
});

// PATCH /api/v1/universes/:id/session  — pause | resume
router.patch('/', (req, res) => {
  const { action } = req.body;
  const sess = db.getActiveSession(req.params.id);

  if (action === 'pause') {
    sessionMgr.pauseSession(req.params.id);
    if (sess) db.pauseSession(sess.id);
    return res.json({ status: 'paused' });
  }

  if (action === 'resume') {
    const orch = sessionMgr.getSession(req.params.id);
    if (orch) {
      sessionMgr.resumeSession(req.params.id);
    } else if (sess) {
      // Orchestrator was lost (server restart) — recreate it
      sessionMgr.startSession(req.params.id, sess.id);
    } else {
      // No session at all — create a new one
      const newSess = db.createSession(req.params.id);
      sessionMgr.startSession(req.params.id, newSess.id);
    }
    if (sess) db.resumeSession(sess.id);
    return res.json({ status: 'running' });
  }

  return res.status(400).json({ error: 'action must be "pause" or "resume"' });
});

// DELETE /api/v1/universes/:id/session  — stop
router.delete('/', (req, res) => {
  const sess = db.getActiveSession(req.params.id);
  if (sess) db.stopSession(sess.id);
  sessionMgr.stopSession(req.params.id);
  res.json({ status: 'stopped' });
});

module.exports = router;
