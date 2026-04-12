'use strict';

const { Orchestrator } = require('./Orchestrator');

/** universeId → Orchestrator instance */
const _active = new Map();

function startSession(universeId, sessionId) {
  if (_active.has(universeId)) {
    _active.get(universeId).stop();
  }
  const orch = new Orchestrator(universeId, sessionId);
  _active.set(universeId, orch);
  orch.start();
  return orch;
}

function stopSession(universeId) {
  const orch = _active.get(universeId);
  if (!orch) return false;
  orch.stop();
  _active.delete(universeId);
  return true;
}

function getSession(universeId) {
  return _active.get(universeId) || null;
}

function isRunning(universeId) {
  return _active.has(universeId);
}

module.exports = { startSession, stopSession, getSession, isRunning };
