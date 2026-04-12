# Agentic Universe — Phase 1 & 2 Design

**Date:** 2026-04-12  
**Scope:** Phase 1 (Persistence + Auth Stub) and Phase 2 (React + Three.js Visualization)  
**Status:** Approved

---

## Context

An existing Node.js simulation platform runs tick-based ecosystem simulations with three agent roles (producer, consumer, predator). The backend uses an in-memory JSON file store (`universe-data.json`) and a vanilla JS canvas frontend. This design covers:

- **Phase 1:** Migrate to SQLite, add proper universe data model (privacy, forking, history), stub auth
- **Phase 2:** Replace the frontend with React + React Three Fiber using a Cosmic Void bioluminescent aesthetic and immersive full-screen HUD

Later phases (agent intelligence tiers, institution system, social layer, compute pricing) are explicitly out of scope here.

---

## Phase 1 — Persistence + Auth Stub

### Project Structure

The project restructures into a monorepo with two packages:

```
server/
  src/
    db/
      schema.js          CREATE TABLE statements and indexes
      universes.js       universe CRUD
      snapshots.js       snapshot read/write/retention/query
      tickStats.js       tick stats read/write
      users.js           single admin user stub
      index.js           re-exports all db modules
    simulation/          moved from current src/simulation/ — no changes
    routes/
      v1/
        universes.js     GET/POST/PUT/DELETE + fork endpoint
        instances.js     start/stop/reset/config patch/state
        snapshots.js     list/get/fork-from-snapshot
    middleware/
      auth.js            Bearer token check (stub)
    server.js
  package.json

client/
  src/                   React + Vite app (Phase 2)
  vite.config.js
  package.json

package.json             root — npm workspaces ["server", "client"]
universe.db              SQLite database file (gitignored)
```

The simulation engine (`server/src/simulation/`) is not modified — only moved.

---

### SQLite Schema

Four tables. Agent state is stored as JSON blobs to avoid a schema that changes with each new agent type.

```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  username     TEXT NOT NULL,
  session_token TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE universes (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  description              TEXT NOT NULL DEFAULT '',
  privacy                  TEXT NOT NULL DEFAULT 'private',
  owner_id                 TEXT NOT NULL REFERENCES users(id),
  forked_from_id           TEXT REFERENCES universes(id) ON DELETE SET NULL,
  forked_from_snapshot_id  INTEGER,        -- FK to snapshots managed at app level (circular ref)
  retention_days           INTEGER,        -- NULL = unlimited
  config                   TEXT NOT NULL,  -- JSON blob
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL
);

CREATE TABLE snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  universe_id  TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  instance_id  TEXT NOT NULL,
  tick         INTEGER NOT NULL,
  label        TEXT,                -- optional user bookmark label
  state        TEXT NOT NULL,       -- JSON blob (full agent state)
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_snapshots_universe_tick ON snapshots(universe_id, tick);

CREATE TABLE tick_stats (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  universe_id  TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
  instance_id  TEXT NOT NULL,
  tick         INTEGER NOT NULL,
  stats        TEXT NOT NULL,       -- JSON blob
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_tick_stats_universe_tick ON tick_stats(universe_id, tick);
```

**Cascade deletes:** removing a universe wipes its snapshots and tick_stats automatically. `forked_from_id` uses `ON DELETE SET NULL` — deleting a parent universe nulls the reference on its forks rather than blocking or cascading. `forked_from_snapshot_id` is stored as a plain integer (no DB-level FK) because snapshots cascade-delete when their universe is deleted, which would otherwise violate a FK constraint on the forked universe; nulling is handled in the application's delete path instead.

---

### Auth Stub

A single admin user is seeded at server startup. The `ADMIN_TOKEN` environment variable sets the token; if unset, one is auto-generated and printed to stdout on first run.

All `/api/v1/` routes are protected by `middleware/auth.js`:

```
Authorization: Bearer <token>
```

Returns `401` if missing or incorrect. This is the exact interface real auth (username/password or OAuth) will replace in a future phase — the middleware signature does not change.

---

### REST API

```
GET    /api/v1/universes                          list all universes
POST   /api/v1/universes                          create universe
GET    /api/v1/universes/:id                      get universe
PUT    /api/v1/universes/:id                      update universe config/meta
DELETE /api/v1/universes/:id                      delete universe + cascade

POST   /api/v1/universes/:id/fork
  body: { snapshotId? }
  No snapshotId → config-only fork, new universe starts at tick 0
  With snapshotId → config + agent state loaded from that snapshot

GET    /api/v1/universes/:id/snapshots            list (pagination: ?limit=&before=tick)
GET    /api/v1/universes/:id/snapshots/:snapId    full snapshot state

GET    /api/v1/instances                          list active instances
POST   /api/v1/instances                          create instance (links universe to slot)
DELETE /api/v1/instances/:id                      destroy instance
POST   /api/v1/instances/:id/start               start simulation
POST   /api/v1/instances/:id/stop                stop simulation
POST   /api/v1/instances/:id/reset               reset to tick 0
PATCH  /api/v1/instances/:id/config              runtime config overrides (tickInterval, etc.)
GET    /api/v1/instances/:id/state               current live state snapshot
```

---

### Snapshot Retention

A background job runs every 60 seconds in the same Node process. For universes where `retention_days` is non-null, it deletes snapshots and tick_stats older than `now - retention_days * 86400000` ms. Universes with `retention_days = NULL` are never pruned.

---

### Migration from JSON File Store

The existing `src/db/database.js` is replaced entirely. The new `server/src/db/` modules expose the same function signatures where possible (`saveUniverse`, `getUniverse`, `listUniverses`, `deleteUniverse`, `saveSnapshot`, `listSnapshots`, `getSnapshot`, `saveTickStats`, `getTickStats`) so callers in the simulation engine and routes need minimal changes.

If `universe-data.json` exists on first startup, its universes are imported into SQLite automatically, then the file is left in place but ignored on subsequent starts.

---

## Phase 2 — React + Three.js Visualization

### Tech Stack

| Package | Purpose |
|---------|---------|
| `vite` | Build tool, dev server (proxies `/api/v1/` and WS to Express) |
| `react`, `react-dom` | UI framework |
| `@react-three/fiber` | React renderer for Three.js |
| `@react-three/drei` | OrbitControls, HTML overlay helpers |
| `@react-three/postprocessing` | Bloom (UnrealBloomPass) |
| `zustand` | Simulation state + UI state |

The existing vanilla JS frontend (`public/`) is removed. Express serves the Vite build from `client/dist/` in production. In development, Vite's dev server runs on a separate port with proxy config.

---

### Visual Aesthetic — Cosmic Void

- **Background:** `#04000a` (near-black with slight purple tint)
- **Star field:** ~200 static dim points, rendered once
- **Agent colors by role:**
  - Producer (plants): `#84cc16` acid green
  - Consumer (herbivores): `#a855f7` electric violet
  - Predator (carnivores): `#f97316` neon orange
  - Apex predator (if present): `#ec4899` hot pink
- **Glow:** `EffectComposer → Bloom` pass. Threshold tuned so only bright agent cores bloom; background stays dark
- **Trails:** ring buffer of last 8 positions per agent, rendered as `LineSegments` with alpha fading toward tail. Trail length scales with agent speed
- **Event effects:**
  - Eat: particle burst in prey's color at prey's position
  - Reproduce: expanding ring pulse in parent's color
  - Death: rapid fade + small implosion particles

---

### Layout — Immersive Full-Screen (Layout B)

The Three.js canvas fills 100% of the viewport. All controls are floating HUD overlays rendered via `@react-three/drei`'s `Html` component (pointer-events disabled on the canvas so HUD elements receive clicks).

**HUD elements:**

| Element | Position | Description |
|---------|----------|-------------|
| Top bar | top, full-width | `☰` menu · universe name · live badge · connection dot · tick counter · playback controls · speed selector |
| Stats panel | top-right, floating | Per-type population counts with color dots and mini bars. Births/deaths per minute below a divider. Collapsible. |
| Agent tooltip | near selected agent | Appears on agent click. Shows ID, energy, age, state, offspring count. |
| Zoom indicator | bottom-right above scrubber | Current zoom level and mode (overview / cluster / track) |
| Sidebar | left, slides in | Universe list, active slots, templates. Triggered by `☰`. |
| Bottom scrubber | bottom, full-width | Timeline slider with snapshot marker dots. Playback position thumb. LIVE button. |

---

### Rendering Architecture

**Overview mode (default):** All agents rendered as a single `Points` mesh with a circular glow sprite texture. One draw call regardless of agent count. Camera positioned to fit the full world bounds.

**Cluster mode (zoom 2×–8×):** `Points` mesh remains but agents transition toward visible `Mesh` spheres using `lerp` on size. Trails become visible.

**Track mode (zoom > 8× or agent selected):** Camera locks to selected agent using `useFrame` + lerp. Individual `Mesh` spheres with `MeshStandardMaterial` (emissive color = agent color). Agent tooltip shown.

Zoom level is computed from camera Z distance — no manual toggle. `OrbitControls` handles free pan/zoom.

---

### React Component Tree

```
App
└── SimulationProvider        Zustand store + WebSocket connection
    └── UniverseCanvas        R3F Canvas, fills viewport, pointer-events: none
        ├── Scene
        │   ├── StarField     200 static points, rendered once
        │   ├── AgentPoints   all agents, Points mesh
        │   ├── AgentTrails   LineSegments, ring buffer trails
        │   ├── EventParticles  eat/reproduce/die burst effects
        │   └── PostFX        EffectComposer + Bloom
        └── HUD               pointer-events: auto
            ├── TopBar
            ├── StatsPanel
            ├── AgentTooltip
            ├── ZoomIndicator
            ├── UniverseSidebar
            └── BottomScrubber
```

---

### Client State (Zustand)

Two stores:

**`simulationStore`**
```js
{
  instanceId, universeId, universeName,
  tick, running, agents[], stats[],
  connected,            // WebSocket status
  playbackMode,         // 'live' | 'replay'
  replaySnapshotId,     // null in live mode
}
```

**`uiStore`**
```js
{
  sidebarOpen,
  selectedAgentId,
  speedMultiplier,      // 0.5 | 1 | 2 | 5 | 10
  snapshots[],          // loaded once on mount for scrubber dots
}
```

---

### Time Controls

- **Play / Pause** — `POST /api/v1/instances/:id/start|stop`
- **Speed** — `PATCH /api/v1/instances/:id/config` with `{ tickInterval: base / multiplier }`
- **Scrubber** — fetches snapshot list on mount, renders dots at proportional tick positions. Clicking/dragging loads `GET /api/v1/universes/:id/snapshots/:snapId`, injects state into simulationStore, switches to `playbackMode: 'replay'`
- **LIVE button** — reconnects WebSocket to real-time stream, switches to `playbackMode: 'live'`, scrubber thumb snaps to right edge
- **Fork from snapshot** — right-click a scrubber dot → "Fork universe from here" → calls `POST /api/v1/universes/:id/fork` with `{ snapshotId }`

---

### Client API Layer

```
client/src/api/
  client.js      fetch() wrapper — injects Authorization header, handles 401 globally
  universes.js   list, get, create, update, delete, fork
  instances.js   create, start, stop, reset, patchConfig, getState
  snapshots.js   list, get, forkFromSnapshot
```

WebSocket is managed in `SimulationProvider`. On `tick` event, agents and stats are written to Zustand. On disconnect, auto-reconnects with exponential backoff (1s, 2s, 4s, max 30s).

---

## Out of Scope (Future Phases)

- User authentication (real accounts, passwords, OAuth) — Phase 3
- Agent intelligence tiers (Tier 2 heuristic, Tier 3 Claude-powered) — Phase 4
- Institution system (agent-built sub-universes) — Phase 5
- Public universe feed, social layer, forking attribution — Phase 6
- Compute credit system and pricing tiers — Phase 7
- Horizontal scaling, PostgreSQL migration — Phase 8
