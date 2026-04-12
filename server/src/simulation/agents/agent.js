'use strict';

const { v4: uuidv4 } = require('uuid');
const { findNearest, moveToward, wander, clamp } = require('../utils');

// ── Factory ───────────────────────────────────────────────────────────────────

function createAgent(typeId, x, y, typeCfg) {
  return {
    id: uuidv4(),
    typeId,
    role: typeCfg.role,
    x, y,
    energy: typeCfg.initialEnergy || 0,
    age: 0,
    alive: true,
    reproductionCooldown: 0,
    direction: Math.random() * Math.PI * 2,
    state: typeCfg.role === 'producer' ? 'idle' : 'wandering',
    memory: {},  // reserved for future Claude-based reasoning
  };
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Advance one agent by one tick.
 * Mutates the agent in place.
 * Pushes visual events into the provided `events` array.
 * Returns an array of offspring agents (may be empty).
 */
function updateAgent(agent, typeCfg, agents, universeConfig, events) {
  agent.age++;

  if (typeCfg.role === 'producer') return []; // producers just age; spawning is separate

  agent.energy -= typeCfg.energyDecayRate;
  if (agent.reproductionCooldown > 0) agent.reproductionCooldown--;

  if (agent.energy <= 0 || (typeCfg.maxLifespan > 0 && agent.age >= typeCfg.maxLifespan)) {
    agent.alive = false;
    agent.state = 'dead';
    return [];
  }

  const { worldWidth, worldHeight } = universeConfig;

  // ── Find nearest prey ──────────────────────────────────────────────────────
  let target = null;
  let preyEnergyValue = 30;

  for (const eatTypeId of (typeCfg.eats || [])) {
    const candidates = [...agents.values()].filter(a => a.typeId === eatTypeId && a.alive);
    const nearest = findNearest(agent, candidates, typeCfg.visionRange);
    if (nearest) {
      target = nearest;
      const preyType = universeConfig.agentTypes.find(t => t.id === eatTypeId);
      preyEnergyValue = preyType ? preyType.energyValue : 30;
      break;
    }
  }

  // ── Move & eat ─────────────────────────────────────────────────────────────
  if (target) {
    const dx = target.x - agent.x;
    const dy = target.y - agent.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= typeCfg.eatRange) {
      target.alive = false;
      target.state = 'dead';
      agent.energy = Math.min(typeCfg.maxEnergy, agent.energy + preyEnergyValue);
      agent.state = 'eating';
      events.push({ type: 'eat', agentType: agent.typeId, color: typeCfg.color, x: target.x, y: target.y });
    } else {
      agent.state = typeCfg.role === 'predator' ? 'hunting' : 'seeking_food';
      moveToward(agent, target, typeCfg.speed, worldWidth, worldHeight);
    }
  } else {
    agent.state = 'wandering';
    wander(agent, typeCfg.speed, typeCfg.wanderTurnRate || 0.2, worldWidth, worldHeight);
  }

  // ── Reproduction ───────────────────────────────────────────────────────────
  const offspring = [];
  if (
    typeCfg.reproductionThreshold > 0 &&
    agent.energy >= typeCfg.reproductionThreshold &&
    agent.reproductionCooldown === 0
  ) {
    agent.energy -= typeCfg.reproductionCost;
    agent.reproductionCooldown = typeCfg.reproductionCooldown;
    agent.state = 'reproducing';
    events.push({ type: 'reproduce', agentType: agent.typeId, color: typeCfg.color, x: agent.x, y: agent.y });

    const child = createAgent(
      agent.typeId,
      clamp(agent.x + (Math.random() - 0.5) * 30, 0, worldWidth),
      clamp(agent.y + (Math.random() - 0.5) * 30, 0, worldHeight),
      typeCfg,
    );
    child.energy = Math.floor(typeCfg.reproductionCost * (typeCfg.offspringEnergyRatio || 0.5));
    offspring.push(child);
  }

  return offspring;
}

// ── Producer spawning ─────────────────────────────────────────────────────────

/**
 * Possibly spawn new producer agents this tick.
 * Returns an array of newly created agents.
 */
function spawnProducers(agents, universeConfig) {
  const { worldWidth, worldHeight, agentTypes } = universeConfig;
  const newAgents = [];

  for (const typeCfg of agentTypes) {
    if (typeCfg.role !== 'producer') continue;

    const live = [...agents.values()].filter(a => a.typeId === typeCfg.id && a.alive);
    if (live.length >= (typeCfg.maxCount || 120)) continue;
    if (Math.random() >= (typeCfg.spawnRate || 0.15)) continue;

    let x, y;
    const bias = typeCfg.clusterBias ?? 0.65;
    const radius = typeCfg.clusterRadius ?? 60;

    if (live.length > 0 && Math.random() < bias) {
      const parent = live[Math.floor(Math.random() * live.length)];
      x = clamp(parent.x + (Math.random() - 0.5) * 2 * radius, 0, worldWidth);
      y = clamp(parent.y + (Math.random() - 0.5) * 2 * radius, 0, worldHeight);
    } else {
      x = Math.random() * worldWidth;
      y = Math.random() * worldHeight;
    }

    newAgents.push(createAgent(typeCfg.id, x, y, typeCfg));
  }

  return newAgents;
}

module.exports = { createAgent, updateAgent, spawnProducers };
