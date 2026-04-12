'use strict';

const { saveTool, getTool: dbGetTool, listTools: dbListTools, incrementUseCount } = require('../db/tools');
const { PHASE1 } = require('./builtinTools');

function seedBuiltins() {
  for (const spec of PHASE1) {
    saveTool(spec);
  }
}

function getTool(name) {
  return dbGetTool(name);
}

function listAvailable() {
  return dbListTools({ implemented: true });
}

function listAll() {
  return dbListTools();
}

function getToolsForAgent(permissions) {
  const all = listAvailable();
  return all.filter(t => permissions.includes(t.name));
}

function registerSynthesized(spec) {
  return saveTool({ ...spec, implemented: true });
}

function recordUse(name) {
  incrementUseCount(name);
}

module.exports = { seedBuiltins, getTool, listAvailable, listAll, getToolsForAgent, registerSynthesized, recordUse };
