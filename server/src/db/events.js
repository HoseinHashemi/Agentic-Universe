'use strict';

const { getDb } = require('./schema');

function enqueueEvent({ universe_id, session_id, type, source, payload }) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO events (universe_id, session_id, type, source, payload, status, created_at)
    VALUES (?,?,?,?,?,'pending',?)
  `).run(universe_id, session_id || null, type, source, JSON.stringify(payload), Date.now());
  return getEvent(result.lastInsertRowid);
}

function getEvent(id) {
  const row = getDb().prepare('SELECT * FROM events WHERE id = ?').get(id);
  return row ? _deserialize(row) : null;
}

function claimEvent(id) {
  getDb().prepare(
    "UPDATE events SET status = 'processing' WHERE id = ?"
  ).run(id);
  return getEvent(id);
}

function markEventDone(id) {
  getDb().prepare(
    "UPDATE events SET status = 'done', processed_at = ? WHERE id = ?"
  ).run(Date.now(), id);
}

function markEventFailed(id) {
  getDb().prepare(
    "UPDATE events SET status = 'failed', processed_at = ? WHERE id = ?"
  ).run(Date.now(), id);
}

function nextPendingEvent(universeId) {
  const row = getDb().prepare(
    "SELECT * FROM events WHERE universe_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1"
  ).get(universeId);
  return row ? _deserialize(row) : null;
}

function listEvents(universeId, { status, limit = 50, offset = 0 } = {}) {
  if (status) {
    return getDb().prepare(
      'SELECT * FROM events WHERE universe_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(universeId, status, limit, offset).map(_deserialize);
  }
  return getDb().prepare(
    'SELECT * FROM events WHERE universe_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(universeId, limit, offset).map(_deserialize);
}

function _deserialize(row) {
  return { ...row, payload: JSON.parse(row.payload) };
}

module.exports = { enqueueEvent, getEvent, claimEvent, markEventDone, markEventFailed, nextPendingEvent, listEvents };
