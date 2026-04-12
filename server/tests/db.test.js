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

test('agents CRUD', () => {
  const db = getDb();
  // seed a user and universe needed for FK constraints
  db.prepare('INSERT OR IGNORE INTO users (id,username,session_token,created_at) VALUES (?,?,?,?)').run('u1','admin','tok',Date.now());
  db.prepare('INSERT OR IGNORE INTO universes (id,name,owner_id,config,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('univ1','Test','u1','{}',Date.now(),Date.now());

  const { createAgent, getAgent, listAgents, updateAgentStatus, updateAgentMemory } = require('../src/db/agents');

  const agent = createAgent({
    universe_id: 'univ1',
    name: 'Sam',
    role: 'Detective',
    goals: 'Solve cases',
    personality: 'Cynical',
    type: 'llm',
    tool_permissions: ['send_message'],
  });
  assert.ok(agent.id.startsWith('ag_'));
  assert.equal(agent.name, 'Sam');
  assert.deepEqual(agent.tool_permissions, ['send_message']);

  const fetched = getAgent(agent.id);
  assert.equal(fetched.role, 'Detective');

  const list = listAgents('univ1');
  assert.equal(list.length, 1);

  updateAgentStatus(agent.id, 'active');
  assert.equal(getAgent(agent.id).status, 'active');

  updateAgentMemory(agent.id, { last_case: 'Doe' });
  assert.equal(getAgent(agent.id).memory.last_case, 'Doe');
});

test('sessions CRUD', () => {
  const { createSession, getSession, getActiveSession, stopSession } = require('../src/db/sessions');

  const sess = createSession('univ1');
  assert.ok(sess.id.startsWith('sess_'));
  assert.equal(sess.status, 'running');
  assert.equal(sess.universe_id, 'univ1');

  const fetched = getSession(sess.id);
  assert.equal(fetched.id, sess.id);

  const active = getActiveSession('univ1');
  assert.equal(active.id, sess.id);

  stopSession(sess.id);
  assert.equal(getSession(sess.id).status, 'stopped');
  assert.equal(getActiveSession('univ1'), null);
});
