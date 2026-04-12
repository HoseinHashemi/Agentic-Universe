'use strict';

const express = require('express');
const db = require('../../db');
const { ADMIN_ID } = require('../../db/users');

const router = express.Router({ mergeParams: true });

// GET /api/v1/universes/:id/snapshots
router.get('/', (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const before = req.query.before ? parseInt(req.query.before) : null;
  const snaps = db.listSnapshots(id, { limit, before });
  res.json({ snapshots: snaps });
});

// GET /api/v1/universes/:id/snapshots/:snapId
router.get('/:snapId', (req, res) => {
  const snapId = parseInt(req.params.snapId);
  const snap = db.getSnapshot(snapId);
  if (!snap || snap.universe_id !== req.params.id) {
    return res.status(404).json({ error: 'Snapshot not found.' });
  }
  res.json({ snapshot: snap });
});

module.exports = router;
