# Agentic Universe — Sub-project 1: Universe + Agent Core

**Date:** 2026-04-12
**Status:** Approved
**Scope:** NL universe creation, hybrid agent runtime (LLM + rule-based), event-driven orchestrator, chat + visual + dashboard frontend

---

## Vision

Agentic Universe is a platform where anyone can create a living, collaborative multi-agent system using plain natural language. A universe could be a noir detective agency, a financial research lab, a planet with custom physics, a scientific experiment, or anything else imaginable. Agents within a universe reason, communicate, produce artifacts, recruit new agents, and evolve — all driven by events, all observable in real time.

This sub-project delivers the core: creating a universe from a description, running hybrid agents in an event-driven loop, and observing everything through a three-panel interface (chat, visual, dashboard).

---

## What Is Out of Scope Here

- External tool integrations (web search, code execution sandbox, financial APIs)
- Cross-universe agent communication
- Universe sharing / discovery / marketplace
- User authentication beyond the existing admin token stub
- Flexible execution models (timers, scheduled triggers) — event-driven only for now
- Billing / compute pricing

These are planned for subsequent sub-projects.

---

## Core Concepts

### Universe
A named sandbox defined entirely in natural language. Stored with:
- `description` — the user's original words
- `manifest` — structured JSON extracted by Claude on creation (agent definitions, rules, initial events, knowledge base seed)
- `knowledge_base` — a shared JSON document all agents can read and write to

### Agent
A named participant. Each agent has a role, goals, personality, type (`llm` or `rule`), tool permissions, and a rolling memory. The Orchestrator decides which agents respond to each event and whether to use LLM or rule logic.

### Event
The atomic unit of activity. Every state change — a user message, an agent action, a spawn request — becomes an event in a durable queue. The Orchestrator processes events one at a time per session.

### Artifact
Anything an agent produces: a document, a plan, a piece of code, a data table. Stored, versioned, visible to other agents and the user.

### Orchestrator
A server-side process (one per active session) that owns the event queue. It reads each event, decides which agents should respond (via a lightweight Claude routing call or manifest rules), calls agents, collects outputs, and re-enqueues any resulting actions. Sleeps between events.

---

## Data Model

Builds on existing `users` and `universes` tables. Replaces `snapshots`, `tick_stats`, `instances`/`sessions`.

```sql
-- Existing, extended
ALTER TABLE universes ADD COLUMN manifest TEXT;         -- JSON agent manifest
ALTER TABLE universes ADD COLUMN knowledge_base TEXT;   -- JSON shared memory

-- New tables
CREATE TABLE agents (
  id              TEXT PRIMARY KEY,
  universe_id     TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL,
  goals           TEXT NOT NULL,
  personality     TEXT NOT NULL DEFAULT '',
  type            TEXT NOT NULL DEFAULT 'llm',   -- 'llm' | 'rule'
  tool_permissions TEXT NOT NULL DEFAULT '[]',   -- JSON array
  memory          TEXT NOT NULL DEFAULT '{}',    -- JSON rolling memory
  rule_logic      TEXT,                          -- JS condition→action string for rule-based agents
  status          TEXT NOT NULL DEFAULT 'idle',  -- 'idle' | 'active' | 'dormant'
  created_at      INTEGER NOT NULL
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'paused' | 'stopped'
  started_at  INTEGER NOT NULL,
  stopped_at  INTEGER
);

CREATE TABLE events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  universe_id  TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  session_id   TEXT REFERENCES sessions(id),
  type         TEXT NOT NULL,   -- 'user_message' | 'agent_message' | 'agent_action' | 'spawn_request' | 'system'
  source       TEXT NOT NULL,   -- 'user' | agent id | 'system'
  payload      TEXT NOT NULL,   -- JSON
  status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'done' | 'failed'
  created_at   INTEGER NOT NULL,
  processed_at INTEGER
);
CREATE INDEX idx_events_universe_status ON events(universe_id, status);

CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  from_id     TEXT NOT NULL,    -- agent id | 'user' | 'system'
  to_id       TEXT NOT NULL,    -- agent id | 'all'
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_messages_universe ON messages(universe_id, created_at);

CREATE TABLE artifacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  agent_id    TEXT REFERENCES agents(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'text',   -- 'text' | 'code' | 'data' | 'plan'
  content     TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);
```

**Key decisions:**
- `agents.memory` is a rolling JSON blob trimmed to stay within LLM context limits (~2000 tokens worth of facts)
- `events` table is the durable queue — Orchestrator pulls `pending`, marks `processing`, writes outputs, marks `done`
- `agents.rule_logic` stores a JS expression evaluated server-side for rule-based agents (no LLM call)
- Cascade deletes: removing a universe removes agents, events, messages, artifacts

---

## Universe Creation Flow

### Step 1 — User submits NL description
`POST /api/v1/universes` with `{ description: "A 1920s noir detective agency..." }`

### Step 2 — Parse call (one Claude API call)
Server sends the description to Claude with a system prompt that instructs it to return a structured manifest. Claude returns:

```json
{
  "universe_name": "The Marlowe Agency",
  "summary": "Three detectives with contrasting methods solve cases...",
  "agents": [
    {
      "name": "Sam",
      "role": "Hard-boiled detective",
      "goals": "Solve cases by any means necessary, protect the agency's reputation",
      "personality": "Cynical, direct, intuitive",
      "type": "llm",
      "tool_permissions": ["send_message", "create_artifact", "spawn_agent"],
      "initial_memory": "I've worked this city for 20 years. I trust no one."
    }
  ],
  "initial_events": [
    { "type": "system", "payload": { "message": "A new client walks in with a missing persons case" } }
  ],
  "interaction_rules": "Detectives debate approaches before acting. The agency takes one case at a time.",
  "knowledge_base_seed": {
    "city": "1920s Chicago",
    "active_cases": [],
    "agency_reputation": "respected but controversial"
  }
}
```

### Step 3 — Seed the DB
Universe row saved with manifest + knowledge_base. Agent rows created. Initial events enqueued. Session started automatically.

### Step 4 — Refinement (always NL)
`PUT /api/v1/universes/:id` with `{ instruction: "Add an agent who plays devil's advocate" }` → another Claude call patches the manifest → DB updated → new agent row created → change broadcast over WebSocket.

---

## Orchestrator

One Node.js `EventEmitter`-based process per active session, running in the same server process. Sessions for different universes run independently.

### The loop

```
poll for pending events (every 500ms or triggered by DB write)
  → if none: sleep
  → pick oldest pending event
  → mark as 'processing'
  → routing decision (see below)
  → call agent(s)
  → write outputs to DB (messages, artifacts, new events)
  → broadcast via WebSocket
  → mark event 'done'
  → repeat
```

### Routing decision

**Rule-based path** (no Claude call):
- Event type is deterministic (timer, system trigger)
- Target agent has `type: 'rule'`
- Evaluate `agent.rule_logic` as JS condition; if true, execute the mapped action

**LLM routing path** (one Claude call):
Claude receives: event payload, list of agents with their roles/goals, interaction rules from manifest. Returns:
```json
{ "agents": ["Sam", "Maria"], "order": "parallel", "reasoning": "Both detectives would care about a new case" }
```
For obvious single-agent events (a message addressed `@Sam`), routing is skipped — target is explicit.

### Agent call (LLM agents)

**System prompt:**
```
You are [name], a [role] in [universe name].
Goals: [goals]
Personality: [personality]
Universe context: [summary + interaction_rules]
Shared knowledge: [knowledge_base summary, ~500 tokens]
Your recent memory: [agent.memory, ~500 tokens]
Tools available: [tool_permissions]
```

**User turn:** The event payload as natural language.

**Expected response:**
```json
{
  "thought": "A new case. I should take the lead before Maria does.",
  "actions": [
    { "type": "send_message", "to": "all", "content": "I'll take this one." },
    { "type": "create_artifact", "name": "Case Notes - John Doe", "artifact_type": "text", "content": "..." },
    { "type": "update_memory", "content": "New missing persons case. Client is nervous. Hiding something." }
  ]
}
```

**Supported action types (this sub-project):**
- `send_message` — to a specific agent or `all`
- `create_artifact` — produces a named artifact (text, code, data, plan)
- `spawn_agent` — `{ description: "a forensic expert who..." }` → triggers a new NL parse + agent creation
- `update_memory` — merges content into agent's rolling memory (oldest entries trimmed)

### Memory management
After each agent call, `agent.memory` is updated. Memory is kept to ~2000 tokens. When trimming, oldest entries are summarised by Claude into a single "background" entry before being dropped. This happens asynchronously and does not block the event loop.

### Concurrency
Parallel agents: `Promise.all` on their Claude calls. Sequential agents: awaited in order. The event itself is marked `done` only after all routing outputs are written.

---

## API

All routes under `/api/v1/`, protected by existing Bearer token auth.

### Universes
```
POST   /api/v1/universes                    { description } → create universe
GET    /api/v1/universes                    list all
GET    /api/v1/universes/:id                universe + manifest + agents
PUT    /api/v1/universes/:id                { instruction } → NL patch
DELETE /api/v1/universes/:id
POST   /api/v1/universes/:id/fork           fork with agents + manifest + knowledge base
```

### Sessions
```
POST   /api/v1/universes/:id/session        start session
DELETE /api/v1/universes/:id/session        stop session
GET    /api/v1/universes/:id/session        session status + event queue depth
```

### Interaction
```
POST   /api/v1/universes/:id/message        { content, to? } → enqueue user_message event
GET    /api/v1/universes/:id/messages       paginated message history
GET    /api/v1/universes/:id/events         event log (filterable by agent, type, status)
GET    /api/v1/universes/:id/artifacts      list artifacts
GET    /api/v1/universes/:id/artifacts/:id  full artifact
```

### Agents
```
GET    /api/v1/universes/:id/agents         list agents + status
POST   /api/v1/universes/:id/agents         { description } → add agent via NL
DELETE /api/v1/universes/:id/agents/:agentId
```

### WebSocket (existing `/ws`, extended)
```
Server → Client types:
  agent_thinking     { universeId, agentId, agentName, thought }
  agent_action       { universeId, agentId, agentName, action }
  message_created    { universeId, message }
  artifact_created   { universeId, artifact }
  agent_spawned      { universeId, agent }
  event_processed    { universeId, eventId, status }
  session_status     { universeId, status }
  knowledge_updated  { universeId, patch }
```

---

## Frontend

Three panels on the same page, tabs to switch. All driven by the same WebSocket connection.

### Chat Panel (default)
- Message thread: user messages (right-aligned), agent messages (left-aligned with agent name + color dot), agent-to-agent messages (indented, lighter), system events (centered, muted)
- Typing `@AgentName` directs a message to a specific agent
- Artifact creation shows an inline preview card with "Open" link
- Agent thinking state shows a subtle animated indicator while Claude is processing
- Input bar at bottom: always NL, always available

### Visual Panel (R3F canvas, repurposed)
- Agents as glowing nodes in a 2D space, color-coded by type (LLM = violet, rule-based = green)
- Edges animate when messages pass between agents
- Node pulse on activation; size scales with recent activity
- Artifact cards float near the creating agent; click to open full content
- New agents animate in (expand from spawning agent's node)
- Clicking a node opens a side drawer: agent name, role, goals, current status, memory summary, recent actions
- Background: existing Cosmic Void aesthetic (`#04000a`)

### Dashboard Panel
- **Event Log** (left column): live scrolling list of processed events, filterable by agent/type, each row expandable to show full payload + routing decision + outputs
- **Agents** (center column): status cards — name, role, type badge, status indicator, last action summary, action count
- **Artifacts** (right column): sortable list with type badge, agent name, timestamp, preview on hover
- **Timeline** (bottom): event density sparkline, click to jump to that point in the event log

### Universe Creation Screen
- Full-screen text area: *"Describe your universe..."*
- Submit → loading state with progress text ("Parsing universe...", "Creating agents...", "Seeding first events...")
- On completion: transition to Chat panel, agents appear in Visual panel one by one

### Refinement Input
- Persistent input at the bottom of all three panels
- Placeholder: *"Modify your universe... (e.g. 'make Bob more aggressive', 'add a legal expert')"*
- Distinct visual treatment from the chat input (dashed border, different color)

---

## Dependencies

- **`@anthropic-ai/sdk`** added to `server/package.json` — used for all Claude calls (universe parse, orchestrator routing, agent calls, memory summarisation)
- **`ANTHROPIC_API_KEY`** environment variable required on the server. If unset, server logs a warning and universe creation returns a 503.
- Model: `claude-opus-4-6` for agent calls (highest quality reasoning); `claude-haiku-4-5-20251001` for routing decisions and memory summarisation (speed + cost)

---

## What Reuses vs. What Changes

| Component | Action |
|-----------|--------|
| Monorepo (server/ + client/) | Keep |
| SQLite + node:sqlite | Keep, extend schema |
| Auth middleware | Keep |
| Express + WebSocket | Keep, extend routes |
| React + Vite + R3F | Keep, repurpose canvas |
| Zustand stores | Keep, rewrite for new data model |
| `simulation/` engine | **Replace** with Orchestrator |
| `snapshots`, `tick_stats` tables | **Remove** |
| `instances` concept | **Replace** with `sessions` |
| Agent type colors | Reuse (violet = LLM, green = rule) |

---

## Future Sub-projects (not in scope here)

- **Sub-project 2:** Agent tools — web search, code execution sandbox, external API integrations
- **Sub-project 3:** Cross-universe agent communication protocol
- **Sub-project 4:** Social layer — universe sharing, discovery, forking attribution
- **Sub-project 5:** Flexible execution — timers, scheduled triggers, continuous mode
- **Sub-project 6:** Multi-user auth, compute pricing tiers
