'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const http    = require('http');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const express = require('express');

const { attachWebSocket } = require('./websocket');
const universeRoutes = require('./routes/v1/universes');
const auth           = require('./middleware/auth');
const { ensureAdminUser } = require('./db/users');

const PORT = process.env.PORT || 3000;

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(24).toString('hex');
ensureAdminUser(ADMIN_TOKEN);
if (!process.env.ADMIN_TOKEN) {
  console.log(`[auth] Generated ADMIN_TOKEN: ${ADMIN_TOKEN}`);
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

app.use('/api/v1/universes', auth, universeRoutes);
app.use('/api/v1/universes/:id/session',   auth, require('./routes/v1/sessions'));
app.use('/api/v1/universes/:id/message',   auth, require('./routes/v1/messages'));
app.use('/api/v1/universes/:id/messages',  auth, require('./routes/v1/messages'));
app.use('/api/v1/universes/:id/agents',    auth, require('./routes/v1/agents'));
app.use('/api/v1/universes/:id/artifacts', auth, require('./routes/v1/artifacts'));
app.use('/api/v1/universes/:id/events',    auth, require('./routes/v1/eventsRoute'));

app.get('/health', (_req, res) => res.json({ ok: true }));

if (fs.existsSync(clientDist)) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found.' });
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
}

const httpServer = http.createServer(app);
attachWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  console.log(`[server] ws://localhost:${PORT}/ws`);
});

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

function shutdown() {
  console.log('\n[server] shutting down…');
  httpServer.close(() => { console.log('[server] closed'); process.exit(0); });
}
