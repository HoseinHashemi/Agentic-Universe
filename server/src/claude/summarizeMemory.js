'use strict';

const { callClaude, HAIKU } = require('./client');

const MAX_MEMORY_KEYS = 20;

/**
 * If agent memory exceeds MAX_MEMORY_KEYS, summarize oldest entries into a background fact.
 * Returns the updated memory object (may be the same object if no trimming needed).
 */
async function trimMemory(agentMemory, agentName) {
  const keys = Object.keys(agentMemory);
  if (keys.length <= MAX_MEMORY_KEYS) return agentMemory;

  const oldest = keys.slice(0, keys.length - MAX_MEMORY_KEYS + 1);
  const toSummarize = {};
  for (const k of oldest) toSummarize[k] = agentMemory[k];

  const summary = await callClaude({
    model: HAIKU,
    system: `Summarize the following memory entries for agent "${agentName}" into a single concise paragraph. Return only the paragraph text.`,
    messages: [{ role: 'user', content: JSON.stringify(toSummarize, null, 2) }],
    max_tokens: 256,
  });

  const trimmed = {};
  for (const k of keys.slice(oldest.length)) trimmed[k] = agentMemory[k];
  trimmed['_background'] = summary.trim();

  return trimmed;
}

module.exports = { trimMemory };
