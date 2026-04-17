'use strict';

const { Router } = require('express');
const db = require('../../db');

const router = Router({ mergeParams: true });

// GET /api/v1/universes/:id/events
router.get('/', (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  const events = db.listEvents(req.params.id, { status, limit: +limit, offset: +offset });
  res.json({ events });
});

module.exports = router;
