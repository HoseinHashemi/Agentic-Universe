'use strict';

// Phase 1 built-in tool catalog entries.
// These are catalog metadata only — actual execution is in toolExecutor.js.

const PHASE1 = [
  // ── Communication ────────────────────────────────────────────────────────────
  {
    name: 'send_message',
    category: 'communication',
    description: 'Send a message to a specific agent, all agents, or the user',
    input_schema: { to: 'string', content: 'string' },
    output_schema: { message_id: 'number' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'broadcast',
    category: 'communication',
    description: 'Send a message to all agents and the user simultaneously',
    input_schema: { content: 'string' },
    output_schema: { message_id: 'number' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'delegate_task',
    category: 'communication',
    description: 'Assign a task to another agent with a description',
    input_schema: { to: 'string', task: 'string' },
    output_schema: { event_id: 'number' },
    implemented: true, async: false, sandboxed: false,
  },
  // ── Memory & Knowledge ────────────────────────────────────────────────────────
  {
    name: 'update_memory',
    category: 'memory',
    description: 'Merge a key-value pair into own rolling memory',
    input_schema: { key: 'string', value: 'string' },
    output_schema: { ok: 'boolean' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'read_knowledge_base',
    category: 'memory',
    description: 'Read a key from the universe shared knowledge base',
    input_schema: { key: 'string' },
    output_schema: { value: 'any' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'write_knowledge_base',
    category: 'memory',
    description: 'Write or update a key in the universe shared knowledge base',
    input_schema: { key: 'string', value: 'any' },
    output_schema: { ok: 'boolean' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'create_knowledge_entry',
    category: 'memory',
    description: 'Add a structured fact, decision, or finding to the knowledge base',
    input_schema: { key: 'string', value: 'any', label: 'string' },
    output_schema: { ok: 'boolean' },
    implemented: true, async: false, sandboxed: false,
  },
  // ── Artifacts ────────────────────────────────────────────────────────────────
  {
    name: 'create_artifact',
    category: 'artifacts',
    description: 'Produce a named artifact (text, code, data, plan, report)',
    input_schema: { name: 'string', type: 'string', content: 'string' },
    output_schema: { artifact_id: 'number' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'update_artifact',
    category: 'artifacts',
    description: 'Append to or revise an existing artifact (creates new version)',
    input_schema: { artifact_id: 'number', content: 'string' },
    output_schema: { artifact_id: 'number', version: 'number' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'read_artifact',
    category: 'artifacts',
    description: 'Read an artifact by id',
    input_schema: { artifact_id: 'number' },
    output_schema: { name: 'string', type: 'string', content: 'string' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'publish_artifact',
    category: 'artifacts',
    description: 'Mark an artifact as a final output visible prominently to the user',
    input_schema: { artifact_id: 'number' },
    output_schema: { ok: 'boolean' },
    implemented: true, async: false, sandboxed: false,
  },
  // ── Agent Management ─────────────────────────────────────────────────────────
  {
    name: 'spawn_agent',
    category: 'agents',
    description: 'Create a new agent from a natural language description',
    input_schema: { description: 'string' },
    output_schema: { agent_id: 'string', name: 'string' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'modify_own_goals',
    category: 'agents',
    description: "Update own goals based on new understanding",
    input_schema: { new_goals: 'string' },
    output_schema: { ok: 'boolean' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'list_agents',
    category: 'agents',
    description: 'Get list of all active agents in the universe',
    input_schema: {},
    output_schema: { agents: 'array' },
    implemented: true, async: false, sandboxed: false,
  },
  // ── Code ─────────────────────────────────────────────────────────────────────
  {
    name: 'write_code',
    category: 'code',
    description: 'Produce a code artifact in any language',
    input_schema: { language: 'string', description: 'string', content: 'string' },
    output_schema: { artifact_id: 'number' },
    implemented: true, async: false, sandboxed: false,
  },
  // ── Meta ─────────────────────────────────────────────────────────────────────
  {
    name: 'list_tools',
    category: 'meta',
    description: 'Discover all available tools and their descriptions',
    input_schema: { category: 'string?' },
    output_schema: { tools: 'array' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'request_tool',
    category: 'meta',
    description: 'Request a tool by name — if it does not exist, triggers auto-synthesis',
    input_schema: { tool_name: 'string', description: 'string' },
    output_schema: { status: 'string', tool: 'object?' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'create_tool',
    category: 'meta',
    description: 'Proactively define and synthesise a new tool from a description',
    input_schema: { name: 'string', description: 'string', example_input: 'object?', example_output: 'object?' },
    output_schema: { status: 'string', tool: 'object?' },
    implemented: true, async: false, sandboxed: false,
  },
  {
    name: 'reflect',
    category: 'meta',
    description: 'Generate a structured self-reflection on progress toward goals',
    input_schema: {},
    output_schema: { reflection: 'string' },
    implemented: true, async: false, sandboxed: false,
  },
];

module.exports = { PHASE1 };
