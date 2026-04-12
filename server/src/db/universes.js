'use strict';

const { getDb } = require('./schema');
const { v4: uuidv4 } = require('uuid');
const { ADMIN_ID } = require('./users');

/**
 * Save (create or update) a universe.
 * data shape: { id?, name, description?, privacy?, config, owner_id?,
 *               forked_from_id?, forked_from_snapshot_id?, retention_days? }
 * config is an opaque JSON object (being replaced by manifest + knowledge_base in Task 2)
 */
function saveUniverse(data) {
  const db = getDb();
  const now = Date.now();
  const id = data.id || ('u_' + uuidv4().slice(0, 8));

  const existing = db.prepare('SELECT created_at FROM universes WHERE id = ?').get(id);
  if (existing) {
    db.prepare(`
      UPDATE universes
         SET name = ?, description = ?, privacy = ?, config = ?, updated_at = ?
       WHERE id = ?
    `).run(
      data.name || 'Untitled',
      data.description || '',
      data.privacy || 'private',
      JSON.stringify(data.config),
      now,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO universes
        (id, name, description, privacy, owner_id, forked_from_id,
         forked_from_snapshot_id, retention_days, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name || 'Untitled',
      data.description || '',
      data.privacy || 'private',
      data.owner_id || ADMIN_ID,
      data.forked_from_id || null,
      data.forked_from_snapshot_id || null,
      data.retention_days || null,
      JSON.stringify(data.config),
      data.created_at || now,
      now
    );
  }
  return getUniverse(id);
}

function getUniverse(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM universes WHERE id = ?').get(id);
  return row ? _deserialize(row) : null;
}

function listUniverses() {
  const db = getDb();
  return db.prepare(
    'SELECT id, name, description, privacy, owner_id, forked_from_id, created_at, updated_at FROM universes ORDER BY created_at DESC'
  ).all();
}

function deleteUniverse(id) {
  const db = getDb();
  // Clear forked_from_snapshot_id on child universes before deleting snapshots
  db.prepare('UPDATE universes SET forked_from_snapshot_id = NULL WHERE forked_from_id = ?').run(id);
  const result = db.prepare('DELETE FROM universes WHERE id = ?').run(id);
  return result.changes > 0;
}

function _deserialize(row) {
  return { ...row, config: JSON.parse(row.config) };
}

module.exports = { saveUniverse, getUniverse, listUniverses, deleteUniverse };
