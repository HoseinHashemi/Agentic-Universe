# Agentic Universe — Sub-project 1: Universe + Agent Core

**Date:** 2026-04-12
**Status:** Approved
**Scope:** NL universe creation, hybrid agent runtime (LLM + rule-based), event-driven orchestrator, chat + visual + dashboard frontend

---

## Vision

Agentic Universe is a platform where anyone can create a living, collaborative multi-agent system using plain natural language. A universe could be a noir detective agency, a financial research lab, a planet with custom physics, a scientific experiment, or anything else imaginable. Agents within a universe reason, communicate, produce artifacts, recruit new agents, and evolve — all driven by events, all observable in real time.

This sub-project delivers the core: creating a universe from a description, running hybrid agents in an event-driven loop, and observing everything through a three-panel interface (chat, visual, dashboard).

---

## What Is Out of Scope Here (implementation only — all are architecturally designed)

- **Phase 2 tools:** code execution, web search, external APIs, databases, data analysis, diagrams
- **Phase 3 tools:** image/animation/audio generation, app/website/game creation
- **Phase 4 tools:** model training, deployment, email, cross-universe recruitment, skills
- **Cross-universe agent communication** — protocol designed in sub-project 3
- **Universe sharing / discovery / marketplace** — sub-project 4
- **Multi-user auth** — sub-project 6
- **Flexible execution models** (timers, scheduled triggers) — sub-project 5
- **Billing / compute pricing** — sub-project 6

The Tool Registry, permission model, and action schema are designed here to accommodate all phases without re-architecting.

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

**Action format — every agent response action uses this shape:**
```json
{ "type": "<tool_name>", ...tool-specific fields }
```
The Orchestrator looks up the tool in the Tool Registry, checks the agent's `tool_permissions`, executes it, and returns the result to the agent in the next turn if needed (async tools) or immediately (sync tools).

---

## Tool System

### Architecture

**Tool Registry** — a server-side catalog of every available tool. Each entry defines:
```js
{
  name: 'web_search',
  category: 'research',
  description: 'Search the internet for information',
  input_schema: { query: 'string', max_results: 'number?' },
  output_schema: { results: 'array' },
  async: true,           // result returned in a follow-up event
  sandboxed: false,
  implementation_phase: 2   // 1 = Sub-project 1, 2 = Sub-project 2, etc.
}
```

**Tool Permissions** — each agent's `tool_permissions` is an array of tool names. The manifest parse call assigns appropriate permissions based on the agent's role and the universe description. Universe creators can grant or revoke permissions at any time via NL instruction.

**Tool Execution** — the Orchestrator executes tools between agent calls:
- Sync tools: execute immediately, result included in next agent context
- Async tools: enqueue a `tool_result` event, agent is called again when result arrives
- Sandboxed tools (code execution): run in an isolated Node.js `vm` context or Docker container

**Tool Discovery** — agents can call `list_tools` to see what's available. They can call `request_tool` to ask the Orchestrator to enable a tool they don't currently have access to (creates a `tool_request` event visible to the user).

---

### Full Tool Taxonomy

#### Category 1 — Communication & Collaboration
| Tool | Description | Phase |
|------|-------------|-------|
| `send_message` | Send a message to a specific agent, all agents, or the user | 1 |
| `broadcast` | Send a message to all agents + the user simultaneously | 1 |
| `mention` | Notify a specific agent without blocking | 1 |
| `request_feedback` | Ask a specific agent or the user to review something | 1 |
| `delegate_task` | Assign a task to another agent with a description and deadline | 1 |

#### Category 2 — Memory & Knowledge
| Tool | Description | Phase |
|------|-------------|-------|
| `update_memory` | Merge content into own rolling memory | 1 |
| `read_knowledge_base` | Query the universe's shared knowledge base | 1 |
| `write_knowledge_base` | Write or update a key in the shared knowledge base | 1 |
| `search_knowledge_base` | Semantic search across the knowledge base | 2 |
| `create_knowledge_entry` | Add a structured entry (fact, decision, finding) | 1 |

#### Category 3 — Artifact Creation & Management
| Tool | Description | Phase |
|------|-------------|-------|
| `create_artifact` | Produce a named artifact (text, code, data, plan, report) | 1 |
| `update_artifact` | Append to or revise an existing artifact (new version) | 1 |
| `read_artifact` | Read an artifact produced by self or another agent | 1 |
| `publish_artifact` | Mark an artifact as a final output (visible to user prominently) | 1 |
| `link_artifacts` | Create a dependency/reference link between two artifacts | 2 |

#### Category 4 — Agent Management
| Tool | Description | Phase |
|------|-------------|-------|
| `spawn_agent` | Create a new agent from a NL description | 1 |
| `recruit_agent` | Bring an agent from another universe into this one | 3 |
| `assign_role` | Change another agent's role or goals (if permitted) | 2 |
| `dismiss_agent` | Remove an agent from the universe | 2 |
| `modify_own_goals` | Update own goals based on new understanding | 1 |
| `list_agents` | Get list of all active agents in the universe | 1 |

#### Category 5 — Code & Computation
| Tool | Description | Phase |
|------|-------------|-------|
| `write_code` | Produce a code artifact in any language | 1 |
| `execute_code` | Run code in an isolated sandbox, capture stdout/stderr/result | 2 |
| `create_simulation` | Define a simulation with parameters and rules | 2 |
| `run_simulation` | Execute a simulation, return results as artifact | 2 |
| `create_database` | Create an in-universe SQLite database with a schema | 2 |
| `query_database` | Run SQL against an in-universe database | 2 |
| `run_formula` | Evaluate a mathematical formula or expression | 2 |
| `create_dataset` | Define and populate a structured dataset | 2 |
| `analyze_data` | Run statistical analysis on a dataset | 2 |
| `train_model` | Fine-tune or prompt-engineer a model on a dataset | 4 |

#### Category 6 — Research & Information
| Tool | Description | Phase |
|------|-------------|-------|
| `web_search` | Search the internet | 2 |
| `fetch_url` | Fetch and extract content from a URL | 2 |
| `search_papers` | Search academic publications (arXiv, Semantic Scholar) | 2 |
| `read_paper` | Fetch and summarise an academic paper | 2 |
| `get_news` | Fetch recent news on a topic | 2 |

#### Category 7 — Creative & Media Generation
| Tool | Description | Phase |
|------|-------------|-------|
| `generate_image` | Generate an image from a text description | 3 |
| `create_animation` | Generate an animated sequence or video | 3 |
| `generate_audio` | Synthesise speech or music from description | 3 |
| `create_game_world` | Scaffold a playable game or interactive simulation | 3 |
| `create_3d_scene` | Generate a 3D environment description / Three.js scene | 3 |
| `generate_diagram` | Create architecture, flow, or data diagrams | 2 |

#### Category 8 — App & Web Development
| Tool | Description | Phase |
|------|-------------|-------|
| `create_app` | Scaffold a full application (frontend + backend) | 3 |
| `create_website` | Generate a static or dynamic website | 3 |
| `create_api` | Define and implement an API endpoint | 3 |
| `deploy` | Deploy an artifact to a hosting environment | 4 |
| `create_ui_component` | Generate a React/HTML component | 3 |

#### Category 9 — External Integrations
| Tool | Description | Phase |
|------|-------------|-------|
| `call_api` | Make an authenticated HTTP request to an external API | 2 |
| `read_file` | Read a file from the universe's file store | 2 |
| `write_file` | Write a file to the universe's file store | 2 |
| `send_email` | Send an email via configured provider | 4 |
| `call_webhook` | POST to an external webhook URL | 2 |

#### Category 10 — Meta & Self-Improvement
| Tool | Description | Phase |
|------|-------------|-------|
| `list_tools` | Discover available tools and their descriptions | 1 |
| `request_tool` | Ask the Orchestrator to enable a tool | 1 |
| `reflect` | Generate a structured self-reflection on progress toward goals | 1 |
| `propose_rule_change` | Suggest a change to the universe's interaction rules | 2 |
| `create_skill` | Define a reusable behaviour pattern other agents can adopt | 4 |

---

### Tool Implementation Notes

**Phase 1 tools** are implemented in this sub-project. All others are registered in the Tool Registry with `implemented: false` — agents can see them and request them, but calling them returns a clear "tool not yet available" response rather than an error.

**Code execution sandbox** (Phase 2): Node.js `vm` module for simple scripts; Docker container for full isolation when executing untrusted or long-running code. Each universe gets a persistent file system volume for `read_file`/`write_file`.

**External API calls** (Phase 2): agent provides URL, method, headers, body. The Orchestrator validates against a allowlist (configurable per universe). Rate limiting applied per universe.

**Creative generation tools** (Phase 3): delegate to external model APIs (image generation, TTS, etc.). Results stored as binary artifacts in the file store, referenced by URL in the artifact record.

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

## Sub-project Roadmap

| Sub-project | Scope |
|-------------|-------|
| **1 (this)** | Universe + Agent Core: NL creation, Orchestrator, Phase 1 tools, three-panel UI |
| **2** | Phase 2 tools: code execution sandbox, web search, external APIs, databases, data analysis, file store, diagrams |
| **3** | Phase 3 tools: image/audio/animation generation, app/website/game scaffolding; cross-universe agent communication protocol |
| **4** | Social layer: universe sharing, discovery feed, forking attribution, public/private visibility |
| **5** | Flexible execution: timers, scheduled triggers, continuous mode per universe |
| **6** | Multi-user auth (real accounts, OAuth), compute usage tracking, pricing tiers |
| **7** | Phase 4 tools: model training, deployment, agent skills marketplace, cross-universe recruitment |
