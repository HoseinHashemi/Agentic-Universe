'use strict';

const { v4: uuidv4 } = require('uuid');
const { findNearest, moveToward, wander, clamp } = require('../utils');

function createCarnivore(x, y, config) {
  const cfg = config.carnivore;
  return {
    id: uuidv4(),
    type: 'carnivore',
    x,
    y,
    energy: cfg.initialEnergy,
    age: 0,
    alive: true,
    reproductionCooldown: 0,
    direction: Math.random() * 2 * Math.PI,
    state: 'wandering',
    memory: {},
  };
}

/**
 * Advance carnivore by one tick.
 * Mutates the carnivore in place.
 * Returns { agent, offspring[] }.
 */
function updateCarnivore(carnivore, agents, config) {
  const cfg = config.carnivore;
  const { worldWidth, worldHeight } = config;

  carnivore.age++;
  carnivore.energy -= cfg.energyDecayRate;
  if (carnivore.reproductionCooldown > 0) carnivore.reproductionCooldown--;

  // Death by starvation or old age
  if (carnivore.energy <= 0 || carnivore.age >= cfg.maxLifespan) {
    carnivore.alive = false;
    carnivore.state = 'dead';
    return { agent: carnivore, offspring: [], events: [] };
  }

  const events = [];

  // --- Find prey (live herbivores only) ---
  const herbivores = [...agents.values()].filter(a => a.type === 'herbivore' && a.alive);
  const target = findNearest(carnivore, herbivores, cfg.visionRange);

  if (target) {
    const dx = target.x - carnivore.x;
    const dy = target.y - carnivore.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= cfg.eatRange) {
      // Kill and eat
      target.alive = false;
      target.state = 'dead';
      carnivore.energy = Math.min(cfg.maxEnergy, carnivore.energy + target.energy);
      carnivore.state = 'eating';
      events.push({ type: 'eat', agentType: 'carnivore', x: target.x, y: target.y });
    } else {
      carnivore.state = 'hunting';
      moveToward(carnivore, target, cfg.moveSpeed, worldWidth, worldHeight);
    }
  } else {
    carnivore.state = 'wandering';
    wander(carnivore, cfg.moveSpeed, cfg.wanderTurnRate, worldWidth, worldHeight);
  }

  // --- Reproduction ---
  const offspring = [];
  if (carnivore.energy >= cfg.reproductionThreshold && carnivore.reproductionCooldown === 0) {
    carnivore.energy -= cfg.reproductionCost;
    carnivore.reproductionCooldown = cfg.reproductionCooldown;
    carnivore.state = 'reproducing';
    events.push({ type: 'reproduce', agentType: 'carnivore', x: carnivore.x, y: carnivore.y });

    const child = createCarnivore(
      clamp(carnivore.x + (Math.random() - 0.5) * 30, 0, worldWidth),
      clamp(carnivore.y + (Math.random() - 0.5) * 30, 0, worldHeight),
      config,
    );
    child.energy = Math.floor(cfg.reproductionCost * cfg.offspringEnergyRatio);
    offspring.push(child);
  }

  return { agent: carnivore, offspring, events };
}

module.exports = { createCarnivore, updateCarnivore };
