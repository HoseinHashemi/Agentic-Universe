'use strict';

process.env.DB_PATH = ':memory:';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

let registry;

before(() => {
  // Init DB first
  require('../src/db/schema').getDb();
  registry = require('../src/orchestrator/toolRegistry');
  registry.seedBuiltins();
});

after(() => {
  require('../src/db/schema').closeDb();
});

test('seedBuiltins registers Phase 1 tools', () => {
  const tools = registry.listAvailable();
  const names = tools.map(t => t.name);
  assert.ok(names.includes('send_message'));
  assert.ok(names.includes('create_artifact'));
  assert.ok(names.includes('update_memory'));
  assert.ok(names.includes('spawn_agent'));
  assert.ok(names.includes('list_tools'));
  assert.ok(names.includes('create_tool'));
});

test('getToolsForAgent filters by permissions', () => {
  const tools = registry.getToolsForAgent(['send_message', 'create_artifact']);
  assert.equal(tools.length, 2);
  assert.ok(tools.every(t => ['send_message', 'create_artifact'].includes(t.name)));
});

test('getTool returns null for unknown tool', () => {
  assert.equal(registry.getTool('nonexistent_xyz'), null);
});
