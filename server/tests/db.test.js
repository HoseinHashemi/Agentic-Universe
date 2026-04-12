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

test('events queue', () => {
  const { enqueueEvent, getEvent, claimEvent, markEventDone, nextPendingEvent, listEvents } = require('../src/db/events');

  const ev = enqueueEvent({
    universe_id: 'univ1',
    session_id: null,
    type: 'user_message',
    source: 'user',
    payload: { content: 'Hello' },
  });
  assert.ok(ev.id > 0);
  assert.equal(ev.status, 'pending');
  assert.deepEqual(ev.payload, { content: 'Hello' });

  const next = nextPendingEvent('univ1');
  assert.equal(next.id, ev.id);

  claimEvent(ev.id);
  assert.equal(getEvent(ev.id).status, 'processing');
  assert.equal(nextPendingEvent('univ1'), null); // claimed, not pending

  markEventDone(ev.id);
  const events = listEvents('univ1', { status: 'done' });
  assert.equal(events.length, 1);
  assert.ok(events[0].processed_at > 0);
});

test('messages', () => {
  const { createMessage, listMessages } = require('../src/db/messages');

  createMessage({ universe_id: 'univ1', from_id: 'user', to_id: 'all', content: 'Hi' });
  createMessage({ universe_id: 'univ1', from_id: 'user', to_id: 'all', content: 'World' });
  const msgs = listMessages('univ1', { limit: 10 });
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].content, 'Hi');
  assert.equal(msgs[1].content, 'World');
});

test('artifacts', () => {
  const { createArtifact, getArtifact, updateArtifact, listArtifacts } = require('../src/db/artifacts');

  const art = createArtifact({ universe_id: 'univ1', agent_id: null, name: 'Report', type: 'text', content: 'Body' });
  assert.ok(art.id > 0);
  assert.equal(art.name, 'Report');
  assert.equal(art.version, 1);

  const updated = updateArtifact(art.id, 'New Body');
  assert.equal(updated.version, 2);
  assert.equal(updated.content, 'New Body');

  const list = listArtifacts('univ1');
  assert.equal(list.length, 1);
});

test('tools registry', () => {
  const { saveTool, getTool, listTools, incrementUseCount } = require('../src/db/tools');

  const tool = saveTool({
    name: 'send_message',
    category: 'communication',
    description: 'Send a message',
    input_schema: { to: 'string', content: 'string' },
    output_schema: { message_id: 'number' },
    implementation: '',
    implemented: true,
  });
  assert.equal(tool.name, 'send_message');
  assert.ok(tool.implemented);
  assert.deepEqual(tool.input_schema, { to: 'string', content: 'string' });

  const fetched = getTool('send_message');
  assert.equal(fetched.category, 'communication');

  const all = listTools();
  assert.equal(all.length, 1);

  incrementUseCount('send_message');
  assert.equal(getTool('send_message').use_count, 1);
});
