'use strict';

const { getDb } = require('./schema');

function saveSnapshot({ universeId, instanceId, tick, state, label = null }) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO snapshots (universe_id, instance_id, tick, label, state, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(universeId, instanceId, tick, label, JSON.stringify(state), Date.now());
  return result.lastInsertRowid;
}

/**
 * List snapshots for a universe, newest first.
 * @param {string} universeId
 * @param {object} opts - { limit?: number, before?: number } (before = tick cursor for pagination)
 */
function listSnapshots(universeId, { limit = 50, before = null } = {}) {
  const db = getDb();
  if (before != null) {
    return db.prepare(`
      SELECT id, universe_id, instance_id, tick, label, created_at
        FROM snapshots
       WHERE universe_id = ? AND tick < ?
       ORDER BY tick DESC
       LIMIT ?
    `).all(universeId, before, limit);
  }
  return db.prepare(`
    SELECT id, universe_id, instance_id, tick, label, created_at
      FROM snapshots
     WHERE universe_id = ?
     ORDER BY tick DESC
     LIMIT ?
  `).all(universeId, limit);
}

function getSnapshot(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, state: JSON.parse(row.state) };
}

module.exports = { saveSnapshot, listSnapshots, getSnapshot };
