'use strict';

const { Router } = require('express');
const db = require('../../db');

const router = Router({ mergeParams: true });

// GET /api/v1/universes/:id/artifacts
router.get('/', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const artifacts = db.listArtifacts(req.params.id, { limit: +limit, offset: +offset });
  res.json({ artifacts });
});

// GET /api/v1/universes/:id/artifacts/:artId
router.get('/:artId', (req, res) => {
  const art = db.getArtifact(+req.params.artId);
  if (!art || art.universe_id !== req.params.id) return res.status(404).json({ error: 'Artifact not found.' });
  res.json({ artifact: art });
});

module.exports = router;
