'use strict';

const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const express = require('express');

const { attachWebSocket, registerEngineEvents } = require('./websocket');
const universeRoutes  = require('./routes/v1/universes');
const instanceRoutes  = require('./routes/v1/instances');
const snapshotRoutes  = require('./routes/v1/snapshots');
const im              = require('./simulation/instanceManager');
const auth            = require('./middleware/auth');
const db              = require('./db');
const { ensureAdminUser } = require('./db/users');

const { registerInstance, getUniverseId } = instanceRoutes;

const PORT = process.env.PORT || 3000;

// ─── Auth bootstrap ───────────────────────────────────────────────────────────

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(24).toString('hex');
ensureAdminUser(ADMIN_TOKEN);
if (!process.env.ADMIN_TOKEN) {
  console.log(`[auth] Generated ADMIN_TOKEN: ${ADMIN_TOKEN}`);
}

// ─── JSON file migration ──────────────────────────────────────────────────────

const LEGACY_JSON = path.join(__dirname, '../../..', 'universe-data.json');
if (fs.existsSync(LEGACY_JSON)) {
  try {
    const data = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8'));
    const universes = data.universes || {};
    const imported = [];
    for (const u of Object.values(universes)) {
      if (!db.getUniverse(u.id)) {
        db.saveUniverse({
          id: u.id,
          name: u.name || 'Imported',
          description: u.description || '',
          privacy: 'private',
          config: u.config || u,
          created_at: u.createdAt || Date.now(),
        });
        imported.push(u.id);
      }
    }
    if (imported.length) console.log(`[db] Imported ${imported.length} universes from universe-data.json`);
  } catch (err) {
    console.warn('[db] Could not import legacy JSON:', err.message);
  }
}

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Serve built client in production
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/v1/universes', auth, universeRoutes);
app.use('/api/v1/universes/:id/snapshots', auth, snapshotRoutes);
app.use('/api/v1/instances', auth, instanceRoutes);

app.get('/health', (req, res) => {
  const instances = im.getAllInstances().map(({ slot, engine }) => ({
    slot,
    instanceId: engine.instanceId,
    universeId: getUniverseId(engine.instanceId),
    tick: engine.tick,
    running: engine.running,
    agentCount: engine.agents.size,
  }));
  res.json({ ok: true, instances });
});

// SPA fallback for client-side routing
if (fs.existsSync(clientDist)) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found.' });
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
}

// ─── HTTP + WebSocket ─────────────────────────────────────────────────────────

const httpServer = http.createServer(app);
attachWebSocket(httpServer);

// ─── Engine → DB ──────────────────────────────────────────────────────────────

function wireEnginePersistence(slot, engine) {
  engine.on('snapshot', ({ tick, state }) => {
    const universeId = getUniverseId(engine.instanceId);
    if (!universeId) return;
    try {
      db.saveSnapshot({ universeId, instanceId: engine.instanceId, tick, state });
      db.saveTickStats({ universeId, instanceId: engine.instanceId, tick, stats: state.stats });
    } catch (err) {
      console.error(`[DB] slot ${slot} snapshot error:`, err.message);
    }
  });
}

// ─── Snapshot retention job ───────────────────────────────────────────────────

function startRetentionJob() {
  setInterval(() => {
    try {
      const { getDb } = require('./db/schema');
      const sqlDb = getDb();
      const now = Date.now();
      const universes = sqlDb.prepare(
        'SELECT id, retention_days FROM universes WHERE retention_days IS NOT NULL'
      ).all();
      for (const u of universes) {
        const cutoff = now - u.retention_days * 86_400_000;
        sqlDb.prepare('DELETE FROM snapshots  WHERE universe_id = ? AND created_at < ?').run(u.id, cutoff);
        sqlDb.prepare('DELETE FROM tick_stats WHERE universe_id = ? AND created_at < ?').run(u.id, cutoff);
      }
    } catch (err) {
      console.error('[retention] Error:', err.message);
    }
  }, 60_000);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const DEFAULT_UNIVERSE_ID = 'simple-ecosystem';

httpServer.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  console.log(`[server] ws://localhost:${PORT}/ws`);

  const engine1 = im.bootDefault();
  registerInstance(engine1.instanceId, DEFAULT_UNIVERSE_ID);
  registerEngineEvents(1, engine1);
  wireEnginePersistence(1, engine1);
  engine1.start();
  console.log('[engine] slot 1 started (simple-ecosystem)');

  startRetentionJob();
});

// Wrap createInstance so API-triggered launches are auto-wired
const _origCreate = im.createInstance.bind(im);
im.createInstance = function (slot, cfg) {
  const engine = _origCreate(slot, cfg);
  if (slot !== 1 || !engine._wsWired) {
    registerEngineEvents(slot, engine);
    wireEnginePersistence(slot, engine);
    engine._wsWired = true;
  }
  return engine;
};

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

function shutdown() {
  console.log('\n[server] shutting down…');
  im.getAllInstances().forEach(({ engine }) => engine.stop());
  httpServer.close(() => { console.log('[server] closed'); process.exit(0); });
}
