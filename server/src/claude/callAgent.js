'use strict';

const { callClaude, OPUS } = require('./client');

/**
 * Call an LLM agent and get its response.
 * @returns {{ thought: string, actions: Array<{type: string, ...}> }}
 */
async function callAgent({ agent, event, universe, sharedKnowledge, availableTools }) {
  const toolList = availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n');

  const system = `You are ${agent.name}, a ${agent.role} in ${universe.name}.

Goals: ${agent.goals}
Personality: ${agent.personality || 'professional and focused'}
Universe context: ${universe.manifest?.summary || universe.description}
Interaction rules: ${universe.manifest?.interaction_rules || 'collaborate with other agents'}

Shared knowledge base:
${JSON.stringify(sharedKnowledge, null, 2).slice(0, 1500)}

Your recent memory:
${JSON.stringify(agent.memory, null, 2).slice(0, 1000)}

Available tools:
${toolList || 'none'}

When you respond, return ONLY valid JSON in this exact shape:
{
  "thought": "your internal reasoning (not shown to others)",
  "actions": [
    { "type": "send_message", "to": "all", "content": "..." },
    { "type": "create_artifact", "name": "...", "type": "text", "content": "..." }
  ]
}

Each action's "type" must exactly match a tool name from your available tools list.
You may take 0-5 actions. Actions are executed in order.`;

  const userContent = `Event: ${event.type}
${JSON.stringify(event.payload, null, 2)}`;

  const text = await callClaude({
    model: OPUS,
    system,
    messages: [{ role: 'user', content: userContent }],
    max_tokens: 2048,
  });

  try {
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      thought: parsed.thought || '',
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    // Fallback: treat raw text as a message
    return {
      thought: 'Could not parse structured response',
      actions: [{ type: 'send_message', to: 'all', content: text.slice(0, 500) }],
    };
  }
}

module.exports = { callAgent };
