'use strict';

const { getDb } = require('./schema');

function createMessage({ universe_id, from_id, to_id, content }) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO messages (universe_id, from_id, to_id, content, created_at) VALUES (?,?,?,?,?)'
  ).run(universe_id, from_id, to_id, content, Date.now());
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
}

function listMessages(universeId, { limit = 50, offset = 0, before } = {}) {
  if (before) {
    return getDb().prepare(
      'SELECT * FROM messages WHERE universe_id = ? AND created_at < ? ORDER BY created_at ASC LIMIT ? OFFSET ?'
    ).all(universeId, before, limit, offset);
  }
  return getDb().prepare(
    'SELECT * FROM messages WHERE universe_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?'
  ).all(universeId, limit, offset);
}

module.exports = { createMessage, listMessages };
