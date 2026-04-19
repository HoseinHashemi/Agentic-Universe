'use strict';

const { callClaude, OPUS } = require('./client');

const SYSTEM = `You are a universe configuration assistant. Given a natural language description of a universe, extract a structured manifest.

Return ONLY valid JSON with exactly this shape — no markdown, no extra text:
{
  "universe_name": "string",
  "summary": "string (2-3 sentences describing the universe)",
  "agents": [
    {
      "name": "string (short, unique)",
      "role": "string",
      "goals": "string (what drives this agent)",
      "personality": "string (how they behave and communicate)",
      "type": "llm",
      "tool_permissions": ["send_message", "create_artifact", "update_memory", "read_knowledge_base", "write_knowledge_base", "list_agents"],
      "initial_memory": "string (what this agent knows at the start)"
    }
  ],
  "initial_events": [
    { "type": "system", "payload": { "message": "string describing what happens first" } }
  ],
  "interaction_rules": "string (how agents relate to each other and to the user)",
  "knowledge_base_seed": {}
}

Rules:
- Create 2-5 agents appropriate to the universe
- Each agent gets the minimal set of tool_permissions appropriate for their role
- Always include at least one initial_event so agents have something to react to
- tool_permissions must be chosen from: send_message, broadcast, create_artifact, update_artifact, read_artifact, publish_artifact, update_memory, read_knowledge_base, write_knowledge_base, create_knowledge_entry, spawn_agent, modify_own_goals, list_agents, list_tools, request_tool, create_tool, reflect, write_code, delegate_task
- Keep all string values SHORT: summary ≤ 3 sentences, goals ≤ 2 sentences, personality ≤ 1 sentence, initial_memory ≤ 2 sentences, interaction_rules ≤ 2 sentences
- knowledge_base_seed must be a flat object with at most 5 short string values`;

async function parseUniverse(description) {
  const text = await callClaude({
    model: OPUS,
    system: SYSTEM,
    messages: [{ role: 'user', content: description }],
    max_tokens: 4096,
  });

  let manifest;
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    manifest = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Claude returned invalid JSON for universe manifest: ${err.message}\nRaw: ${text.slice(0, 200)}`);
  }

  // Validate required fields
  if (!manifest.universe_name || !Array.isArray(manifest.agents) || manifest.agents.length === 0) {
    throw new Error('Manifest missing required fields (universe_name, agents)');
  }

  return manifest;
}

async function patchUniverseManifest(currentManifest, instruction) {
  const system = `You are a universe configuration assistant. You will receive an existing universe manifest (JSON) and a natural language instruction to modify it. Return the complete updated manifest JSON only — same shape, no extra text.`;

  const text = await callClaude({
    model: OPUS,
    system,
    messages: [{
      role: 'user',
      content: `Current manifest:\n${JSON.stringify(currentManifest, null, 2)}\n\nInstruction: ${instruction}`,
    }],
    max_tokens: 4096,
  });

  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { parseUniverse, patchUniverseManifest };
