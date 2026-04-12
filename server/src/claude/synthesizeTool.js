'use strict';

const { callClaude, OPUS } = require('./client');

const SYSTEM = `You are a tool-synthesis assistant. Given a description of a tool, generate a Node.js implementation.

Return ONLY valid JSON with exactly this shape:
{
  "name": "snake_case_tool_name",
  "category": "communication|memory|artifacts|agents|code|research|meta|custom",
  "description": "one sentence",
  "input_schema": { "param_name": "type_string" },
  "output_schema": { "field_name": "type_string" },
  "implementation": "async function execute(input, ctx) { ... return { ... }; }",
  "tests": [
    { "input": { ... }, "expected_output_keys": ["key1", "key2"] }
  ]
}

Rules:
- The implementation must be a single async function named execute(input, ctx)
- ctx provides: ctx.universe_id, ctx.agent_id, ctx.db (the DB module)
- The function must return a plain object
- Use only Node.js built-ins and the ctx.db module — no external imports
- Keep implementations simple and deterministic`;

async function synthesizeTool(description, exampleInput = null, exampleOutput = null) {
  const userContent = exampleInput
    ? `Description: ${description}\nExample input: ${JSON.stringify(exampleInput)}\nExample output: ${JSON.stringify(exampleOutput)}`
    : `Description: ${description}`;

  const text = await callClaude({
    model: OPUS,
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 2048,
  });

  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  let spec;
  try {
    spec = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`synthesizeTool: invalid JSON from Claude: ${err.message}`);
  }

  return spec;
}

module.exports = { synthesizeTool };
