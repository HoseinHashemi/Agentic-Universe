'use strict';

const { callClaude, OPUS } = require('./client');

const SYSTEM = `You are a universe configuration assistant. Extract a structured manifest from a universe description.

CRITICAL FORMAT RULES:
- Return ONLY a single line of compact JSON — no newlines, no indentation, no markdown fences
- No newlines or line breaks inside any string value — use spaces instead
- No trailing commas

JSON shape (all on one line):
{"universe_name":"string","summary":"string","agents":[{"name":"string","role":"string","goals":"string","personality":"string","type":"llm","tool_permissions":["send_message"],"initial_memory":"string"}],"initial_events":[{"type":"system","payload":{"message":"string"}}],"interaction_rules":"string","knowledge_base_seed":{}}

Content rules:
- 2 to 4 agents only
- Every string value: max 20 words, no newlines
- tool_permissions per agent: 2-4 items chosen from: send_message, broadcast, create_artifact, update_artifact, read_artifact, update_memory, read_knowledge_base, write_knowledge_base, list_agents, reflect, delegate_task
- knowledge_base_seed: at most 3 keys, values max 8 words each`;

async function parseUniverse(description) {
  const text = await callClaude({
    model: OPUS,
    system: SYSTEM,
    messages: [{ role: 'user', content: description }],
    max_tokens: 8192,
  });

  let manifest;
  try {
    // Strip any markdown fences Claude may add despite instructions
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/m, '').trim();
    manifest = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Claude returned invalid JSON for universe manifest: ${err.message}\nRaw: ${text.slice(0, 200)}`);
  }

  if (!manifest.universe_name || !Array.isArray(manifest.agents) || manifest.agents.length === 0) {
    throw new Error('Manifest missing required fields (universe_name, agents)');
  }

  return manifest;
}

async function patchUniverseManifest(currentManifest, instruction) {
  const system = `You are a universe configuration assistant. Modify the given manifest JSON per the instruction.
Return ONLY compact single-line JSON — no newlines, no indentation, no markdown fences.
Keep all string values under 20 words. No newlines inside string values.`;

  const text = await callClaude({
    model: OPUS,
    system,
    messages: [{
      role: 'user',
      content: `Current manifest:\n${JSON.stringify(currentManifest)}\n\nInstruction: ${instruction}`,
    }],
    max_tokens: 8192,
  });

  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { parseUniverse, patchUniverseManifest };
