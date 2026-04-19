'use strict';

const { callClaude, OPUS } = require('./client');
const { jsonrepair } = require('jsonrepair');

const SYSTEM = `You are a universe configuration assistant. Extract a structured manifest from a universe description.

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "universe_name": "string",
  "summary": "string (1-2 sentences)",
  "agents": [
    {
      "name": "string (one word)",
      "role": "string (2-4 words)",
      "goals": "string (one sentence)",
      "personality": "string (one sentence)",
      "type": "llm",
      "tool_permissions": ["send_message", "create_artifact", "update_memory"],
      "initial_memory": "string (one sentence)"
    }
  ],
  "initial_events": [
    { "type": "system", "payload": { "message": "string (one sentence)" } }
  ],
  "interaction_rules": "string (one sentence)",
  "knowledge_base_seed": {}
}

Rules:
- 2 to 4 agents only
- tool_permissions per agent: 2-4 from: send_message, broadcast, create_artifact, update_artifact, read_artifact, update_memory, read_knowledge_base, write_knowledge_base, list_agents, reflect, delegate_task
- knowledge_base_seed: flat object, at most 3 short string values`;

function extractAndRepairJson(text) {
  // Strip markdown fences if present
  let raw = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/m, '').trim();

  // Find the outermost JSON object boundaries
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    raw = raw.slice(start, end + 1);
  } else if (start !== -1) {
    // Truncated — no closing brace found; take everything from '{'
    raw = raw.slice(start);
  }

  // Use jsonrepair to recover from truncation or minor syntax errors
  return jsonrepair(raw);
}

async function parseUniverse(description) {
  const text = await callClaude({
    model: OPUS,
    system: SYSTEM,
    messages: [{ role: 'user', content: description }],
    max_tokens: 16000,
  });

  let manifest;
  try {
    const repaired = extractAndRepairJson(text);
    manifest = JSON.parse(repaired);
  } catch (err) {
    throw new Error(`Claude returned invalid JSON for universe manifest: ${err.message}\nRaw: ${text.slice(0, 200)}`);
  }

  if (!manifest.universe_name || !Array.isArray(manifest.agents) || manifest.agents.length === 0) {
    throw new Error('Manifest missing required fields (universe_name, agents)');
  }

  return manifest;
}

async function patchUniverseManifest(currentManifest, instruction) {
  const system = `You are a universe configuration assistant. Modify the given manifest JSON per the instruction. Return the complete updated manifest JSON only — no markdown, no extra text.`;

  const text = await callClaude({
    model: OPUS,
    system,
    messages: [{
      role: 'user',
      content: `Current manifest:\n${JSON.stringify(currentManifest, null, 2)}\n\nInstruction: ${instruction}`,
    }],
    max_tokens: 16000,
  });

  const repaired = extractAndRepairJson(text);
  return JSON.parse(repaired);
}

module.exports = { parseUniverse, patchUniverseManifest };
