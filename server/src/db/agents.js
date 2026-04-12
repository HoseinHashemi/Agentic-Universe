'use strict';

const { getDb } = require('./schema');
const { v4: uuidv4 } = require('uuid');

function createAgent(data) {
  const db = getDb();
  const id = 'ag_' + uuidv4().slice(0, 8);
  const now = Date.now();
  db.prepare(`
    INSERT INTO agents
      (id, universe_id, name, role, goals, personality, type,
       tool_permissions, memory, rule_logic, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    data.universe_id,
    data.name,
    data.role,
    data.goals,
    data.personality || '',
    data.type || 'llm',
    JSON.stringify(data.tool_permissions || []),
    JSON.stringify(data.memory || {}),
    data.rule_logic || null,
    'idle',
    now
  );
  return getAgent(id);
}

function getAgent(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  return row ? _deserialize(row) : null;
}

function listAgents(universeId) {
  const db = getDb();
  return db.prepare('SELECT * FROM agents WHERE universe_id = ? ORDER BY created_at ASC')
    .all(universeId).map(_deserialize);
}

function updateAgentStatus(id, status) {
  getDb().prepare('UPDATE agents SET status = ? WHERE id = ?').run(status, id);
}

function updateAgentMemory(id, memoryPatch) {
  const agent = getAgent(id);
  if (!agent) return;
  const merged = { ...agent.memory, ...memoryPatch };
  getDb().prepare('UPDATE agents SET memory = ? WHERE id = ?')
    .run(JSON.stringify(merged), id);
}

function deleteAgent(id) {
  return getDb().prepare('DELETE FROM agents WHERE id = ?').run(id).changes > 0;
}

function _deserialize(row) {
  return {
    ...row,
    tool_permissions: JSON.parse(row.tool_permissions),
    memory: JSON.parse(row.memory),
  };
}

module.exports = { createAgent, getAgent, listAgents, updateAgentStatus, updateAgentMemory, deleteAgent };
