'use strict';

const { WebSocketServer } = require('ws');

let _wss = null;

function broadcast(type, payload) {
  if (!_wss) return;
  const msg = JSON.stringify({ type, payload });
  for (const client of _wss.clients) {
    if (client.readyState === client.OPEN) client.send(msg);
  }
}

function attachWebSocket(httpServer) {
  _wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  _wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] client connected: ${ip}`);
    ws.send(JSON.stringify({ type: 'welcome', payload: { ts: Date.now() } }));

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch {
        return ws.send(JSON.stringify({ type: 'error', payload: 'Invalid JSON.' }));
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', payload: { ts: Date.now() } }));
    });

    ws.on('close', () => console.log(`[WS] client disconnected: ${ip}`));
    ws.on('error', err => console.error(`[WS] error from ${ip}:`, err.message));
  });

  return _wss;
}

module.exports = { attachWebSocket, broadcast };
