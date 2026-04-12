'use strict';

const { getDb } = require('./schema');
const { v4: uuidv4 } = require('uuid');
const { ADMIN_ID } = require('./users');

/**
 * Save (create or update) a universe.
 * data shape: { id?, name, description?, privacy?, manifest?, knowledge_base?, config?, owner_id?, forked_from_id? }
 * manifest and knowledge_base are JSON objects stored as TEXT.
 * config is an opaque JSON object (legacy field, kept for compatibility).
 */
function saveUniverse(data) {
  const db = getDb();
  const now = Date.now();
  const id = data.id || ('u_' + uuidv4().slice(0, 8));

  const existing = db.prepare('SELECT created_at FROM universes WHERE id = ?').get(id);
  if (existing) {
    db.prepare(`
      UPDATE universes
         SET name = ?, description = ?, privacy = ?, manifest = ?,
             knowledge_base = ?, config = ?, updated_at = ?
       WHERE id = ?
    `).run(
      data.name || 'Untitled',
      data.description || '',
      data.privacy || 'private',
      data.manifest != null ? JSON.stringify(data.manifest) : null,
      data.knowledge_base != null ? JSON.stringify(data.knowledge_base) : null,
      JSON.stringify(data.config || {}),
      now,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO universes
        (id, name, description, privacy, owner_id, forked_from_id,
         manifest, knowledge_base, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name || 'Untitled',
      data.description || '',
      data.privacy || 'private',
      data.owner_id || ADMIN_ID,
      data.forked_from_id || null,
      data.manifest != null ? JSON.stringify(data.manifest) : null,
      data.knowledge_base != null ? JSON.stringify(data.knowledge_base) : null,
      JSON.stringify(data.config || {}),
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
  const result = getDb().prepare('DELETE FROM universes WHERE id = ?').run(id);
  return result.changes > 0;
}

function _deserialize(row) {
  return {
    ...row,
    manifest: row.manifest ? JSON.parse(row.manifest) : null,
    knowledge_base: row.knowledge_base ? JSON.parse(row.knowledge_base) : {},
    config: row.config ? JSON.parse(row.config) : {},
  };
}

module.exports = { saveUniverse, getUniverse, listUniverses, deleteUniverse };
