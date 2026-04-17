'use strict';

const { Router } = require('express');
const db = require('../../db');
const { broadcast } = require('../../websocket');

const router = Router({ mergeParams: true });

// GET /api/v1/universes/:id/messages
router.get('/', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const msgs = db.listMessages(req.params.id, { limit: +limit, offset: +offset });
  res.json({ messages: msgs });
});

// POST /api/v1/universes/:id/message
router.post('/', (req, res) => {
  const { content, to } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

  const universe = db.getUniverse(req.params.id);
  if (!universe) return res.status(404).json({ error: 'Universe not found.' });

  const msg = db.createMessage({ universe_id: req.params.id, from_id: 'user', to_id: to || 'all', content });

  const sess = db.getActiveSession(req.params.id);
  const ev = db.enqueueEvent({
    universe_id: req.params.id,
    session_id: sess?.id || null,
    type: 'user_message',
    source: 'user',
    payload: { content, to: to || 'all', message_id: msg.id },
  });

  broadcast('message_created', { universeId: req.params.id, message: msg });

  res.status(201).json({ message: msg, event_id: ev.id });
});

module.exports = router;
