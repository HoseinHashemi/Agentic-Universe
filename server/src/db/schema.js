'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH ||
  path.join(__dirname, '../../../..', 'universe.db');

let _db = null;

function getDb() {
  if (_db) return _db;
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  _createTables(_db);
  return _db;
}

function closeDb() {
  if (_db) { _db.close(); _db = null; }
}

function _createTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL,
      session_token TEXT,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS universes (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      privacy        TEXT NOT NULL DEFAULT 'private',
      owner_id       TEXT NOT NULL REFERENCES users(id),
      forked_from_id TEXT REFERENCES universes(id) ON DELETE SET NULL,
      manifest       TEXT,
      knowledge_base TEXT,
      config         TEXT NOT NULL DEFAULT '{}',
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
      id               TEXT PRIMARY KEY,
      universe_id      TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      name             TEXT NOT NULL,
      role             TEXT NOT NULL,
      goals            TEXT NOT NULL,
      personality      TEXT NOT NULL DEFAULT '',
      type             TEXT NOT NULL DEFAULT 'llm',
      tool_permissions TEXT NOT NULL DEFAULT '[]',
      memory           TEXT NOT NULL DEFAULT '{}',
      rule_logic       TEXT,
      status           TEXT NOT NULL DEFAULT 'idle',
      created_at       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      status      TEXT NOT NULL DEFAULT 'running',
      started_at  INTEGER NOT NULL,
      stopped_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS events (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      universe_id  TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      session_id   TEXT REFERENCES sessions(id),
      type         TEXT NOT NULL,
      source       TEXT NOT NULL,
      payload      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      created_at   INTEGER NOT NULL,
      processed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_events_universe_status
      ON events(universe_id, status);

    CREATE TABLE IF NOT EXISTS messages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      from_id     TEXT NOT NULL,
      to_id       TEXT NOT NULL,
      content     TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_universe
      ON messages(universe_id, created_at);

    CREATE TABLE IF NOT EXISTS artifacts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      agent_id    TEXT REFERENCES agents(id) ON DELETE SET NULL,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'text',
      content     TEXT NOT NULL,
      version     INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tools (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL UNIQUE,
      category        TEXT NOT NULL,
      description     TEXT NOT NULL,
      input_schema    TEXT NOT NULL,
      output_schema   TEXT NOT NULL,
      implementation  TEXT NOT NULL DEFAULT '',
      implemented     INTEGER NOT NULL DEFAULT 1,
      async           INTEGER NOT NULL DEFAULT 0,
      sandboxed       INTEGER NOT NULL DEFAULT 1,
      origin_universe TEXT REFERENCES universes(id) ON DELETE SET NULL,
      origin_agent    TEXT REFERENCES agents(id) ON DELETE SET NULL,
      created_at      INTEGER NOT NULL,
      use_count       INTEGER NOT NULL DEFAULT 0
    );
  `);
}

module.exports = { getDb, closeDb };
