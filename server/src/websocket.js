'use strict';

const { WebSocketServer } = require('ws');
const im = require('./simulation/instanceManager');

/**
 * WebSocket server for multi-instance simulation streaming.
 *
 * All messages use the envelope: { type, payload }
 * Payload always includes `slot` so clients can route to the right panel.
 *
 * Server → Client types:
 *   welcome          — sent on connect; contains all active instance states
 *   tick             — per-tick state + events for one slot
 *   started/stopped  — lifecycle events for a slot
 *   reset            — post-reset state for a slot
 *   config_changed   — updated universeConfig for a slot
 *   instance_added   — a new slot was created
 *   instance_removed — a slot was destroyed
 *
 * Client → Server types:
 *   ping → pong
 */

let _wss = null;

function broadcast(type, payload) {
  if (!_wss) return;
  const msg = JSON.stringify({ type, payload });
  for (const client of _wss.clients) {
    if (client.readyState === client.OPEN) client.send(msg);
  }
}

function registerEngineEvents(slot, engine) {
  engine.on('tick',           state  => broadcast('tick',           { slot, ...state }));
  engine.on('started',        ()     => broadcast('started',        { slot, tick: engine.tick }));
  engine.on('stopped',        ()     => broadcast('stopped',        { slot, tick: engine.tick }));
  engine.on('reset',          state  => broadcast('reset',          { slot, ...state }));
  engine.on('config_changed', cfg    => broadcast('config_changed', { slot, config: cfg }));
  engine.on('initialized',    state  => broadcast('instance_added', { slot, ...state }));
}

function attachWebSocket(httpServer) {
  _wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  _wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] client connected: ${ip}`);

    // Send current state of all active instances
    const allStates = im.getAllInstances().map(({ slot, engine }) => ({
      slot,
      ...engine.getState(),
    }));
    ws.send(JSON.stringify({ type: 'welcome', payload: { instances: allStates } }));

    ws.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch {
        return ws.send(JSON.stringify({ type: 'error', payload: 'Invalid JSON.' }));
      }
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', payload: { ts: Date.now() } }));
      }
    });

    ws.on('close', () => console.log(`[WS] client disconnected: ${ip}`));
    ws.on('error', err => console.error(`[WS] error from ${ip}:`, err.message));
  });

  return _wss;
}

module.exports = { attachWebSocket, registerEngineEvents, broadcast };
