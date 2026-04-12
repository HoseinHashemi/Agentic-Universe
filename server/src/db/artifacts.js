'use strict';

const { getDb } = require('./schema');

function createArtifact({ universe_id, agent_id, name, type = 'text', content }) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO artifacts (universe_id, agent_id, name, type, content, version, created_at) VALUES (?,?,?,?,?,1,?)'
  ).run(universe_id, agent_id || null, name, type, content, Date.now());
  return getArtifact(result.lastInsertRowid);
}

function getArtifact(id) {
  return getDb().prepare('SELECT * FROM artifacts WHERE id = ?').get(id) || null;
}

function updateArtifact(id, content) {
  const db = getDb();
  const art = getArtifact(id);
  if (!art) return null;
  db.prepare('UPDATE artifacts SET content = ?, version = ? WHERE id = ?')
    .run(content, art.version + 1, id);
  return getArtifact(id);
}

function listArtifacts(universeId, { limit = 50, offset = 0 } = {}) {
  return getDb().prepare(
    'SELECT * FROM artifacts WHERE universe_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(universeId, limit, offset);
}

module.exports = { createArtifact, getArtifact, updateArtifact, listArtifacts };
