'use strict';

const { callClaude, HAIKU } = require('./client');

/**
 * Decide which agents should handle an event.
 * Returns { agents: string[], order: 'parallel'|'sequential', reasoning: string }
 */
async function routeEvent({ event, agents, interactionRules }) {
  // Explicit @mention in user_message → skip routing
  if (event.type === 'user_message' && event.payload.to && event.payload.to !== 'all') {
    const target = agents.find(a => a.name.toLowerCase() === event.payload.to.toLowerCase());
    if (target) return { agents: [target.name], order: 'sequential', reasoning: 'Explicit @mention' };
  }

  const llmAgents = agents.filter(a => a.type === 'llm');
  if (llmAgents.length === 0) return { agents: [], order: 'sequential', reasoning: 'No LLM agents' };
  if (llmAgents.length === 1) return { agents: [llmAgents[0].name], order: 'sequential', reasoning: 'Only one LLM agent' };

  const agentList = llmAgents.map(a => `- ${a.name}: ${a.role} — ${a.goals}`).join('\n');

  const prompt = `Event type: ${event.type}
Event payload: ${JSON.stringify(event.payload)}
Interaction rules: ${interactionRules || 'none'}

Agents available:
${agentList}

Which agents should respond to this event? Return ONLY valid JSON:
{ "agents": ["Name1", "Name2"], "order": "parallel" | "sequential", "reasoning": "one sentence" }

Rules:
- Include only agents whose role/goals make them relevant to this event
- Use "parallel" if they would respond independently, "sequential" if order matters
- Typically 1-3 agents unless the event is broad`;

  const text = await callClaude({
    model: HAIKU,
    system: 'You are an event routing assistant. Return valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 256,
  });

  try {
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { agents: [llmAgents[0].name], order: 'sequential', reasoning: 'Routing parse error — defaulted to first agent' };
  }
}

module.exports = { routeEvent };
