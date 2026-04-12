'use strict';

const http    = require('http');
const path    = require('path');
const express = require('express');
const { attachWebSocket, registerEngineEvents } = require('./websocket');
const universeRoutes  = require('./routes/universes');
const instanceRoutes  = require('./routes/instances');
const im   = require('./simulation/instanceManager');
const db   = require('./db/database');

const PORT = process.env.PORT || 3000;

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/vendor/three', express.static(path.join(__dirname, '../node_modules/three/build')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', universeRoutes);
app.use('/api', instanceRoutes);

app.get('/health', (req, res) => {
  const instances = im.getAllInstances().map(({ slot, engine }) => ({
    slot,
    tick: engine.tick,
    running: engine.running,
    agentCount: engine.agents.size,
  }));
  res.json({ ok: true, instances });
});

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// ─── HTTP + WebSocket ─────────────────────────────────────────────────────────

const httpServer = http.createServer(app);
attachWebSocket(httpServer);

// ─── Engine → DB ──────────────────────────────────────────────────────────────

function wireEnginePersistence(slot, engine) {
  engine.on('snapshot', ({ tick, state }) => {
    try {
      db.saveSnapshot(tick, state, `slot-${slot}`);
      db.saveTickStats(tick, state.stats, `slot-${slot}`);
    } catch (err) {
      console.error(`[DB] slot ${slot} snapshot error:`, err.message);
    }
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  console.log(`[server] ws://localhost:${PORT}/ws`);

  // Boot default simulation on slot 1
  const engine1 = im.bootDefault();
  engine1._wsWired = true;
  registerEngineEvents(1, engine1);
  wireEnginePersistence(1, engine1);
  engine1.start();
  console.log('[engine] slot 1 started (simple-ecosystem)');
});

// Wrap createInstance so future API-triggered launches are auto-wired
const _origCreate = im.createInstance.bind(im);
im.createInstance = function (slot, cfg) {
  const engine = _origCreate(slot, cfg);
  // Only wire if not already done (slot 1 is wired above)
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
