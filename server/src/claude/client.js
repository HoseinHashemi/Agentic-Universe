'use strict';

const Anthropic = require('@anthropic-ai/sdk');

let _client = null;

function getClient() {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  _client = new Anthropic({ apiKey: key });
  return _client;
}

const OPUS   = 'claude-opus-4-6';
const HAIKU  = 'claude-haiku-4-5-20251001';

async function callClaude({ model = OPUS, system, messages, max_tokens = 4096 }) {
  const client = getClient();
  const response = await client.messages.create({
    model,
    max_tokens,
    system,
    messages,
  });
  return response.content[0].text;
}

module.exports = { callClaude, OPUS, HAIKU };
