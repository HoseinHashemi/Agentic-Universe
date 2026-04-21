'use strict';

const { EventEmitter } = require('events');
const db = require('../db');
const { routeEvent } = require('../claude/routeEvent');
const { callAgent } = require('../claude/callAgent');
const { trimMemory } = require('../claude/summarizeMemory');
const { executeTool } = require('./toolExecutor');
const { getToolsForAgent } = require('./toolRegistry');
const { broadcast } = require('../websocket');

const POLL_INTERVAL_MS = 500;

class Orchestrator extends EventEmitter {
  constructor(universeId, sessionId) {
    super();
    this.universeId  = universeId;
    this.sessionId   = sessionId;
    this._timer      = null;
    this._running    = false;
    this._processing = false;
  }

  start() {
    this._running = true;
    this._schedule();
    broadcast('session_status', { universeId: this.universeId, status: 'running' });
    console.log(`[Orchestrator] started for universe ${this.universeId}`);
  }

  stop() {
    this._running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    broadcast('session_status', { universeId: this.universeId, status: 'stopped' });
    console.log(`[Orchestrator] stopped for universe ${this.universeId}`);
  }

  pause() {
    this._running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    broadcast('session_status', { universeId: this.universeId, status: 'paused' });
    console.log(`[Orchestrator] paused for universe ${this.universeId}`);
  }

  resume() {
    this._running = true;
    this._schedule();
    broadcast('session_status', { universeId: this.universeId, status: 'running' });
    console.log(`[Orchestrator] resumed for universe ${this.universeId}`);
  }

  get status() {
    return this._running ? 'running' : 'paused';
  }

  _schedule() {
    if (!this._running) return;
    this._timer = setTimeout(() => this._tick(), POLL_INTERVAL_MS);
  }

  async _tick() {
    if (this._processing) { this._schedule(); return; }
    const event = db.nextPendingEvent(this.universeId);
    if (!event) { this._schedule(); return; }

    this._processing = true;
    try {
      await this._processEvent(event);
    } catch (err) {
      console.error(`[Orchestrator] event ${event.id} failed:`, err.message);
      db.markEventFailed(event.id);
      broadcast('event_processed', { universeId: this.universeId, eventId: event.id, status: 'failed', error: err.message });
    } finally {
      this._processing = false;
      this._schedule();
    }
  }

  async _processEvent(event) {
    db.claimEvent(event.id);

    const universe = db.getUniverse(this.universeId);
    const agents   = db.listAgents(this.universeId);
    const manifest = universe.manifest || {};
    const kb       = universe.knowledge_base || {};

    // ── Rule-based agents ──────────────────────────────────────────────────────
    for (const agent of agents.filter(a => a.type === 'rule' && a.rule_logic)) {
      try {
        const condition = new Function('event', 'kb', `return (${agent.rule_logic})`);
        if (condition(event, kb)) {
          await this._runAgentActions(agent, [{ type: 'send_message', to: 'all', content: `[${agent.name}] Rule triggered by ${event.type}` }], universe);
        }
      } catch { /* skip malformed rule */ }
    }

    // ── LLM routing ───────────────────────────────────────────────────────────
    const llmAgents = agents.filter(a => a.type === 'llm');
    if (llmAgents.length === 0) {
      db.markEventDone(event.id);
      broadcast('event_processed', { universeId: this.universeId, eventId: event.id, status: 'done' });
      return;
    }

    let routing;
    try {
      routing = await routeEvent({ event, agents: llmAgents, interactionRules: manifest.interaction_rules });
    } catch (err) {
      routing = { agents: [llmAgents[0].name], order: 'sequential', reasoning: `routing error: ${err.message}` };
    }

    const targeted = llmAgents.filter(a => routing.agents.includes(a.name));

    if (routing.order === 'parallel' && targeted.length > 1) {
      await Promise.all(targeted.map(agent => this._callLLMAgent(agent, event, universe, kb)));
    } else {
      for (const agent of targeted) {
        await this._callLLMAgent(agent, event, universe, kb);
      }
    }

    db.markEventDone(event.id);
    broadcast('event_processed', { universeId: this.universeId, eventId: event.id, status: 'done', routing });
  }

  async _callLLMAgent(agent, event, universe, kb) {
    db.updateAgentStatus(agent.id, 'active');
    broadcast('agent_thinking', { universeId: this.universeId, agentId: agent.id, agentName: agent.name });

    const availableTools = getToolsForAgent(agent.tool_permissions);

    let response;
    try {
      response = await callAgent({ agent, event, universe, sharedKnowledge: kb, availableTools });
    } catch (err) {
      console.error(`[Orchestrator] callAgent failed for ${agent.name}:`, err.message);
      db.updateAgentStatus(agent.id, 'idle');
      return;
    }

    if (response.thought) {
      broadcast('agent_thinking', {
        universeId: this.universeId,
        agentId: agent.id,
        agentName: agent.name,
        thought: response.thought,
      });
    }

    await this._runAgentActions(agent, response.actions || [], universe);

    // Async memory trim (non-blocking — does not delay event processing)
    setImmediate(async () => {
      try {
        const fresh = db.getAgent(agent.id);
        if (!fresh) return;
        const trimmed = await trimMemory(fresh.memory, agent.name);
        db.updateAgentMemory(agent.id, trimmed);
      } catch { /* non-critical */ }
    });

    db.updateAgentStatus(agent.id, 'idle');
  }

  async _runAgentActions(agent, actions, universe) {
    for (const action of actions) {
      const { type, ...input } = action;
      try {
        broadcast('agent_action', {
          universeId: this.universeId,
          agentId: agent.id,
          agentName: agent.name,
          action,
        });
        await executeTool({
          toolName: type,
          input,
          universeId: this.universeId,
          agentId: agent.id,
          sessionId: this.sessionId,
        });
      } catch (err) {
        console.warn(`[Orchestrator] tool "${type}" failed for ${agent.name}:`, err.message);
        // Enqueue a system event so the agent can learn about the failure
        db.enqueueEvent({
          universe_id: this.universeId,
          session_id: this.sessionId,
          type: 'system',
          source: 'system',
          payload: { message: `Tool "${type}" failed: ${err.message}`, for_agent: agent.id },
        });
      }
    }
  }
}

module.exports = { Orchestrator };
