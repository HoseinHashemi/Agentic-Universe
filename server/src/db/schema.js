'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../../..', 'universe.db');

let _db = null;

function getDb() {
  if (_db) return _db;
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  _createTables(_db);
  return _db;
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
      id                      TEXT PRIMARY KEY,
      name                    TEXT NOT NULL,
      description             TEXT NOT NULL DEFAULT '',
      privacy                 TEXT NOT NULL DEFAULT 'private',
      owner_id                TEXT NOT NULL REFERENCES users(id),
      forked_from_id          TEXT REFERENCES universes(id) ON DELETE SET NULL,
      forked_from_snapshot_id INTEGER,
      retention_days          INTEGER,
      config                  TEXT NOT NULL,
      created_at              INTEGER NOT NULL,
      updated_at              INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      instance_id TEXT NOT NULL,
      tick        INTEGER NOT NULL,
      label       TEXT,
      state       TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_universe_tick ON snapshots(universe_id, tick);

    CREATE TABLE IF NOT EXISTS tick_stats (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      instance_id TEXT NOT NULL,
      tick        INTEGER NOT NULL,
      stats       TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tick_stats_universe_tick ON tick_stats(universe_id, tick);
  `);
}

module.exports = { getDb };
