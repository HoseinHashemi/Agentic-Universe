'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Use in-memory DB for tests
process.env.DB_PATH = ':memory:';

let getDb, closeDb;

before(() => {
  ({ getDb, closeDb } = require('../src/db/schema'));
});

after(() => {
  closeDb();
});

test('schema creates all required tables', () => {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all().map(r => r.name);

  const required = [
    'agents', 'artifacts', 'events', 'messages',
    'sessions', 'tools', 'universes', 'users',
  ];
  for (const t of required) {
    assert.ok(tables.includes(t), `missing table: ${t}`);
  }
});

test('universes table has manifest and knowledge_base columns', () => {
  const db = getDb();
  const cols = db.prepare('PRAGMA table_info(universes)').all().map(r => r.name);
  assert.ok(cols.includes('manifest'), 'missing manifest column');
  assert.ok(cols.includes('knowledge_base'), 'missing knowledge_base column');
});

test('events table has correct indexes', () => {
  const db = getDb();
  const indexes = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index'"
  ).all().map(r => r.name);
  assert.ok(indexes.includes('idx_events_universe_status'));
  assert.ok(indexes.includes('idx_messages_universe'));
});
