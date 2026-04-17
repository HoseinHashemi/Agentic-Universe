'use strict';

const { Router } = require('express');
const db = require('../../db');
const { parseUniverse, patchUniverseManifest } = require('../../claude/parseUniverse');
const sessionMgr = require('../../orchestrator/sessionManager');
const { seedBuiltins } = require('../../orchestrator/toolRegistry');
const { broadcast } = require('../../websocket');

const router = Router();

// Seed built-in tools on first route load
seedBuiltins();

// GET /api/v1/universes
router.get('/', (_req, res) => {
  res.json({ universes: db.listUniverses() });
});

// GET /api/v1/universes/:id
router.get('/:id', (req, res) => {
  const universe = db.getUniverse(req.params.id);
  if (!universe) return res.status(404).json({ error: 'Universe not found.' });
  const agents = db.listAgents(req.params.id);
  res.json({ universe, agents });
});

// POST /api/v1/universes  — NL creation
router.post('/', async (req, res) => {
  const { description } = req.body;
  if (!description?.trim()) return res.status(400).json({ error: 'description is required' });

  let manifest;
  try {
    manifest = await parseUniverse(description);
  } catch (err) {
    if (err.message.includes('ANTHROPIC_API_KEY')) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' });
    }
    return res.status(500).json({ error: `Failed to parse universe: ${err.message}` });
  }

  const universe = db.saveUniverse({
    name: manifest.universe_name,
    description,
    manifest,
    knowledge_base: manifest.knowledge_base_seed || {},
  });

  // Create agents
  const createdAgents = [];
  for (const agentSpec of manifest.agents || []) {
    const agent = db.createAgent({
      universe_id: universe.id,
      name: agentSpec.name,
      role: agentSpec.role,
      goals: agentSpec.goals,
      personality: agentSpec.personality || '',
      type: agentSpec.type || 'llm',
      tool_permissions: agentSpec.tool_permissions || ['send_message', 'create_artifact', 'update_memory'],
      memory: agentSpec.initial_memory ? { background: agentSpec.initial_memory } : {},
    });
    createdAgents.push(agent);
  }

  // Enqueue initial events
  const sess = db.createSession(universe.id);
  for (const ev of manifest.initial_events || []) {
    db.enqueueEvent({
      universe_id: universe.id,
      session_id: sess.id,
      type: ev.type || 'system',
      source: 'system',
      payload: ev.payload || {},
    });
  }

  // Start orchestrator
  sessionMgr.startSession(universe.id, sess.id);

  broadcast('universe_created', { universe, agents: createdAgents });

  res.status(201).json({ universe, agents: createdAgents, session: sess });
});

// PUT /api/v1/universes/:id  — NL refinement
router.put('/:id', async (req, res) => {
  const { instruction } = req.body;
  if (!instruction?.trim()) return res.status(400).json({ error: 'instruction is required' });

  const universe = db.getUniverse(req.params.id);
  if (!universe) return res.status(404).json({ error: 'Universe not found.' });

  let newManifest;
  try {
    newManifest = await patchUniverseManifest(universe.manifest || {}, instruction);
  } catch (err) {
    return res.status(500).json({ error: `Failed to refine universe: ${err.message}` });
  }

  const updated = db.saveUniverse({ ...universe, manifest: newManifest, name: newManifest.universe_name || universe.name });

  // Add any new agents from the manifest
  const existingNames = db.listAgents(universe.id).map(a => a.name);
  const newAgents = [];
  for (const agentSpec of newManifest.agents || []) {
    if (!existingNames.includes(agentSpec.name)) {
      const agent = db.createAgent({
        universe_id: universe.id,
        name: agentSpec.name,
        role: agentSpec.role,
        goals: agentSpec.goals,
        personality: agentSpec.personality || '',
        type: agentSpec.type || 'llm',
        tool_permissions: agentSpec.tool_permissions || ['send_message', 'create_artifact', 'update_memory'],
        memory: agentSpec.initial_memory ? { background: agentSpec.initial_memory } : {},
      });
      newAgents.push(agent);
      broadcast('agent_spawned', { universeId: universe.id, agent });
    }
  }

  res.json({ universe: updated, new_agents: newAgents });
});

// DELETE /api/v1/universes/:id
router.delete('/:id', (req, res) => {
  sessionMgr.stopSession(req.params.id);
  const ok = db.deleteUniverse(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Universe not found.' });
  res.json({ ok: true });
});

// POST /api/v1/universes/:id/fork
router.post('/:id/fork', (req, res) => {
  const src = db.getUniverse(req.params.id);
  if (!src) return res.status(404).json({ error: 'Universe not found.' });

  const forked = db.saveUniverse({
    name: `${src.name} (fork)`,
    description: src.description,
    manifest: src.manifest,
    knowledge_base: src.knowledge_base,
    forked_from_id: src.id,
  });

  const srcAgents = db.listAgents(src.id);
  const forkedAgents = srcAgents.map(a => db.createAgent({ ...a, id: undefined, universe_id: forked.id }));

  res.status(201).json({ universe: forked, agents: forkedAgents });
});

module.exports = router;
