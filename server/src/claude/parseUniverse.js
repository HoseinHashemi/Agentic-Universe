'use strict';

const { callClaude, OPUS } = require('./client');

const SYSTEM = `You are a universe configuration assistant. Extract a structured manifest from a universe description.

Return ONLY valid JSON — no markdown fences, no extra text, no trailing commas:
{
  "universe_name": "string (≤6 words)",
  "summary": "string (1 sentence MAX)",
  "agents": [
    {
      "name": "string (1 word)",
      "role": "string (≤4 words)",
      "goals": "string (≤15 words)",
      "personality": "string (≤10 words)",
      "type": "llm",
      "tool_permissions": ["send_message", "create_artifact", "update_memory"],
      "initial_memory": "string (≤15 words)"
    }
  ],
  "initial_events": [
    { "type": "system", "payload": { "message": "string (≤20 words)" } }
  ],
  "interaction_rules": "string (≤20 words)",
  "knowledge_base_seed": {}
}

STRICT rules — violating any will cause an error:
- 2 to 4 agents only
- Every string field must respect the word limits above
- tool_permissions: choose 2-4 from: send_message, broadcast, create_artifact, update_artifact, read_artifact, update_memory, read_knowledge_base, write_knowledge_base, list_agents, reflect, delegate_task
- knowledge_base_seed: flat object, at most 3 keys, values ≤ 8 words each
- Return nothing except the JSON object`;

async function parseUniverse(description) {
  const text = await callClaude({
    model: OPUS,
    system: SYSTEM,
    messages: [{ role: 'user', content: description }],
    max_tokens: 8192,
  });

  let manifest;
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
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
  const system = `You are a universe configuration assistant. Modify the given manifest JSON per the instruction. Return the complete updated manifest JSON only — no markdown, no extra text. Keep all string values short (≤20 words each).`;

  const text = await callClaude({
    model: OPUS,
    system,
    messages: [{
      role: 'user',
      content: `Current manifest:\n${JSON.stringify(currentManifest, null, 2)}\n\nInstruction: ${instruction}`,
    }],
    max_tokens: 8192,
  });

  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { parseUniverse, patchUniverseManifest };
