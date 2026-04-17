'use strict';

const { Router } = require('express');
const db = require('../../db');
const { broadcast } = require('../../websocket');
const { parseUniverse } = require('../../claude/parseUniverse');

const router = Router({ mergeParams: true });

// GET /api/v1/universes/:id/agents
router.get('/', (req, res) => {
  const agents = db.listAgents(req.params.id);
  res.json({ agents });
});

// POST /api/v1/universes/:id/agents  — add agent via NL description
router.post('/', async (req, res) => {
  const { description } = req.body;
  if (!description?.trim()) return res.status(400).json({ error: 'description is required' });

  const universe = db.getUniverse(req.params.id);
  if (!universe) return res.status(404).json({ error: 'Universe not found.' });

  // Parse a single-agent manifest
  let parsed;
  try {
    parsed = await parseUniverse(`Add one agent to "${universe.name}": ${description}`);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const spec = parsed.agents?.[0];
  if (!spec) return res.status(500).json({ error: 'Could not extract agent spec.' });

  const agent = db.createAgent({
    universe_id: req.params.id,
    name: spec.name,
    role: spec.role,
    goals: spec.goals,
    personality: spec.personality || '',
    type: spec.type || 'llm',
    tool_permissions: spec.tool_permissions || ['send_message', 'create_artifact', 'update_memory'],
    memory: spec.initial_memory ? { background: spec.initial_memory } : {},
  });

  broadcast('agent_spawned', { universeId: req.params.id, agent });
  res.status(201).json({ agent });
});

// DELETE /api/v1/universes/:id/agents/:agentId
router.delete('/:agentId', (req, res) => {
  const ok = db.deleteAgent(req.params.agentId);
  if (!ok) return res.status(404).json({ error: 'Agent not found.' });
  res.json({ ok: true });
});

module.exports = router;
