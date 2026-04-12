'use strict';

const vm = require('node:vm');
const { broadcast } = require('../websocket');
const registry = require('./toolRegistry');
const db = require('../db');

/**
 * Execute a tool action.
 * @param {object} opts
 * @param {string} opts.toolName
 * @param {object} opts.input
 * @param {string} opts.universeId
 * @param {string} opts.agentId
 * @param {string} opts.sessionId
 * @returns {Promise<object>} tool result
 */
async function executeTool({ toolName, input, universeId, agentId, sessionId }) {
  const tool = registry.getTool(toolName);
  if (!tool) throw new Error(`Tool not found: ${toolName}`);
  if (!tool.implemented) throw new Error(`Tool not yet implemented: ${toolName}`);

  registry.recordUse(toolName);

  const ctx = { universe_id: universeId, agent_id: agentId, session_id: sessionId, db, broadcast };

  switch (toolName) {
    case 'send_message':         return _sendMessage(input, ctx);
    case 'broadcast':            return _broadcast(input, ctx);
    case 'delegate_task':        return _delegateTask(input, ctx, sessionId);
    case 'update_memory':        return _updateMemory(input, ctx);
    case 'read_knowledge_base':  return _readKnowledgeBase(input, ctx);
    case 'write_knowledge_base': return _writeKnowledgeBase(input, ctx);
    case 'create_knowledge_entry': return _createKnowledgeEntry(input, ctx);
    case 'create_artifact':      return _createArtifact(input, ctx);
    case 'update_artifact':      return _updateArtifact(input, ctx);
    case 'read_artifact':        return _readArtifact(input, ctx);
    case 'publish_artifact':     return _publishArtifact(input, ctx);
    case 'spawn_agent':          return _spawnAgent(input, ctx);
    case 'modify_own_goals':     return _modifyOwnGoals(input, ctx);
    case 'list_agents':          return _listAgents(input, ctx);
    case 'write_code':           return _writeCode(input, ctx);
    case 'list_tools':           return _listTools(input, ctx);
    case 'request_tool':         return _requestTool(input, ctx);
    case 'create_tool':          return _createToolAction(input, ctx);
    case 'reflect':              return _reflect(input, ctx);
    default:
      if (tool.implementation) return _runSandboxed(tool.implementation, input, ctx);
      throw new Error(`No executor for tool: ${toolName}`);
  }
}

// ── Built-in implementations ──────────────────────────────────────────────────

function _sendMessage({ to, content }, { universe_id, agent_id }) {
  const agent = db.getAgent(agent_id);
  const msg = db.createMessage({ universe_id, from_id: agent_id, to_id: to || 'all', content });
  broadcast('message_created', { universeId: universe_id, message: { ...msg, agentName: agent?.name } });
  return { message_id: msg.id };
}

function _broadcast({ content }, { universe_id, agent_id }) {
  const agent = db.getAgent(agent_id);
  const msg = db.createMessage({ universe_id, from_id: agent_id, to_id: 'all', content });
  broadcast('message_created', { universeId: universe_id, message: { ...msg, agentName: agent?.name } });
  return { message_id: msg.id };
}

function _delegateTask({ to, task }, { universe_id, agent_id }, sessionId) {
  const ev = db.enqueueEvent({
    universe_id,
    session_id: sessionId,
    type: 'agent_action',
    source: agent_id,
    payload: { action: 'delegate_task', to, task },
  });
  return { event_id: ev.id };
}

function _updateMemory({ key, value }, { agent_id }) {
  db.updateAgentMemory(agent_id, { [key]: value });
  return { ok: true };
}

function _readKnowledgeBase({ key }, { universe_id }) {
  const u = db.getUniverse(universe_id);
  const kb = u?.knowledge_base || {};
  return { value: kb[key] ?? null };
}

function _writeKnowledgeBase({ key, value }, { universe_id }) {
  const u = db.getUniverse(universe_id);
  const kb = { ...(u?.knowledge_base || {}), [key]: value };
  db.saveUniverse({ ...u, knowledge_base: kb });
  broadcast('knowledge_updated', { universeId: universe_id, patch: { [key]: value } });
  return { ok: true };
}

function _createKnowledgeEntry({ key, value, label }, { universe_id }) {
  const u = db.getUniverse(universe_id);
  const kb = { ...(u?.knowledge_base || {}), [key]: { value, label, ts: Date.now() } };
  db.saveUniverse({ ...u, knowledge_base: kb });
  broadcast('knowledge_updated', { universeId: universe_id, patch: { [key]: value } });
  return { ok: true };
}

function _createArtifact({ name, type, content }, { universe_id, agent_id }) {
  const art = db.createArtifact({ universe_id, agent_id, name, type: type || 'text', content });
  broadcast('artifact_created', { universeId: universe_id, artifact: art });
  return { artifact_id: art.id };
}

function _updateArtifact({ artifact_id, content }, { universe_id }) {
  const art = db.updateArtifact(artifact_id, content);
  if (art) broadcast('artifact_created', { universeId: universe_id, artifact: art });
  return { artifact_id, version: art?.version ?? 0 };
}

function _readArtifact({ artifact_id }) {
  const art = db.getArtifact(artifact_id);
  if (!art) return { name: null, type: null, content: null };
  return { name: art.name, type: art.type, content: art.content };
}

function _publishArtifact({ artifact_id }, { universe_id }) {
  const art = db.getArtifact(artifact_id);
  if (art) broadcast('artifact_published', { universeId: universe_id, artifact: art });
  return { ok: true };
}

function _spawnAgent({ description }, { universe_id }) {
  const parts = description.split(/[,.]/, 3);
  const name = parts[0]?.trim() || ('Agent_' + Date.now());
  const role = parts[1]?.trim() || 'Assistant';
  const goals = parts[2]?.trim() || description;
  const agent = db.createAgent({
    universe_id,
    name,
    role,
    goals,
    personality: '',
    type: 'llm',
    tool_permissions: ['send_message', 'create_artifact', 'update_memory', 'list_agents'],
  });
  broadcast('agent_spawned', { universeId: universe_id, agent });
  return { agent_id: agent.id, name: agent.name };
}

function _modifyOwnGoals({ new_goals }, { agent_id }) {
  const { getDb } = require('../db/schema');
  getDb().prepare('UPDATE agents SET goals = ? WHERE id = ?').run(new_goals, agent_id);
  return { ok: true };
}

function _listAgents(_input, { universe_id }) {
  const agents = db.listAgents(universe_id);
  return { agents: agents.map(a => ({ id: a.id, name: a.name, role: a.role, status: a.status })) };
}

function _writeCode({ language, description, content }, { universe_id, agent_id }) {
  const name = `${language}_${description.slice(0, 30).replace(/\s+/g, '_')}`;
  const art = db.createArtifact({ universe_id, agent_id, name, type: 'code', content });
  broadcast('artifact_created', { universeId: universe_id, artifact: art });
  return { artifact_id: art.id };
}

function _listTools({ category } = {}) {
  const tools = registry.listAvailable();
  const filtered = category ? tools.filter(t => t.category === category) : tools;
  return { tools: filtered.map(t => ({ name: t.name, category: t.category, description: t.description })) };
}

async function _requestTool({ tool_name, description }, ctx) {
  const existing = registry.getTool(tool_name);
  if (existing && existing.implemented) return { status: 'available', tool: existing };
  return _synthesizeAndRegister({ name: tool_name, description }, ctx);
}

async function _createToolAction({ name, description, example_input, example_output }, ctx) {
  return _synthesizeAndRegister({ name, description, example_input, example_output }, ctx);
}

async function _synthesizeAndRegister({ name, description, example_input, example_output }, { universe_id, agent_id }) {
  const { synthesizeTool } = require('../claude/synthesizeTool');
  let spec;
  try {
    spec = await synthesizeTool(description, example_input, example_output);
  } catch (err) {
    return { status: 'synthesis_failed', error: err.message };
  }

  if (name) spec.name = name;

  // Test run in sandbox
  let testPassed = true;
  if (spec.tests && spec.tests.length > 0) {
    try {
      const fn = new vm.Script(`(${spec.implementation})`).runInNewContext();
      await fn(spec.tests[0].input, { universe_id, agent_id, db, broadcast });
    } catch {
      testPassed = false;
    }
  }

  if (!testPassed) return { status: 'synthesis_failed', error: 'Sandbox test failed' };

  const tool = registry.registerSynthesized({
    ...spec,
    origin_universe: universe_id,
    origin_agent: agent_id,
  });

  broadcast('tool_created', { universeId: universe_id, tool: { name: tool.name, category: tool.category, description: tool.description } });
  return { status: 'created', tool };
}

function _reflect(_input, { agent_id }) {
  const agent = db.getAgent(agent_id);
  if (!agent) return { reflection: 'Unable to reflect — agent not found.' };
  return { reflection: `I am ${agent.name}, a ${agent.role}. My goals: ${agent.goals}. Current status: ${agent.status}.` };
}

async function _runSandboxed(implementation, input, ctx) {
  const sandbox = vm.createContext({ input, ctx, result: undefined });
  const script = new vm.Script(`
    (async () => {
      const fn = ${implementation};
      result = await fn(input, ctx);
    })()
  `);
  await script.runInContext(sandbox);
  return sandbox.result;
}

module.exports = { executeTool };
