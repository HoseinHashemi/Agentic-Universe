'use strict';

const SimulationEngine = require('./engine');
const { TEMPLATES } = require('./universeConfig');

const MAX_SLOTS = 2;

// Map<slot (1|2), SimulationEngine>
const instances = new Map();

function createInstance(slot, universeConfig) {
  if (slot < 1 || slot > MAX_SLOTS) throw new Error(`slot must be 1–${MAX_SLOTS}`);
  if (instances.has(slot)) destroyInstance(slot);

  const engine = new SimulationEngine(`slot-${slot}`, universeConfig);
  engine.initialize();
  instances.set(slot, engine);
  return engine;
}

function getInstance(slot) {
  return instances.get(slot) || null;
}

function getAllInstances() {
  return [...instances.entries()].map(([slot, eng]) => ({ slot, engine: eng }));
}

function destroyInstance(slot) {
  const eng = instances.get(slot);
  if (!eng) return false;
  eng.stop();
  instances.delete(slot);
  return true;
}

// Boot with default template on slot 1 at startup
function bootDefault() {
  createInstance(1, TEMPLATES['simple-ecosystem']);
  return getInstance(1);
}

module.exports = { createInstance, getInstance, getAllInstances, destroyInstance, bootDefault, MAX_SLOTS };
