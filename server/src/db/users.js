'use strict';

const { getDb } = require('./schema');

const ADMIN_ID = 'admin';

function ensureAdminUser(token) {
  const db = getDb();
  const existing = db.prepare('SELECT id, session_token FROM users WHERE id = ?').get(ADMIN_ID);
  if (existing) {
    if (existing.session_token !== token) {
      db.prepare('UPDATE users SET session_token = ? WHERE id = ?').run(token, ADMIN_ID);
    }
    return;
  }
  db.prepare('INSERT INTO users (id, username, session_token, created_at) VALUES (?, ?, ?, ?)').run(
    ADMIN_ID, 'admin', token, Date.now()
  );
}

function getAdminToken() {
  const db = getDb();
  const user = db.prepare('SELECT session_token FROM users WHERE id = ?').get(ADMIN_ID);
  return user?.session_token || null;
}

module.exports = { ensureAdminUser, getAdminToken, ADMIN_ID };
