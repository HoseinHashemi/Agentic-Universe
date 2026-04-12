'use strict';

const { getDb } = require('./schema');
const { v4: uuidv4 } = require('uuid');

function createSession(universeId) {
  const db = getDb();
  const id = 'sess_' + uuidv4().slice(0, 8);
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (id, universe_id, status, started_at)
    VALUES (?, ?, 'running', ?)
  `).run(id, universeId, now);
  return getSession(id);
}

function getSession(id) {
  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) || null;
}

function getActiveSession(universeId) {
  return getDb().prepare(
    "SELECT * FROM sessions WHERE universe_id = ? AND status = 'running' ORDER BY started_at DESC LIMIT 1"
  ).get(universeId) || null;
}

function stopSession(id) {
  getDb().prepare(
    "UPDATE sessions SET status = 'stopped', stopped_at = ? WHERE id = ?"
  ).run(Date.now(), id);
}

function pauseSession(id) {
  getDb().prepare("UPDATE sessions SET status = 'paused' WHERE id = ?").run(id);
}

function resumeSession(id) {
  getDb().prepare("UPDATE sessions SET status = 'running' WHERE id = ?").run(id);
}

module.exports = { createSession, getSession, getActiveSession, stopSession, pauseSession, resumeSession };
