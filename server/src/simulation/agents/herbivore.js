'use strict';

const { v4: uuidv4 } = require('uuid');
const { findNearest, moveToward, wander, clamp } = require('../utils');

function createHerbivore(x, y, config) {
  const cfg = config.herbivore;
  return {
    id: uuidv4(),
    type: 'herbivore',
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
 * Advance herbivore by one tick.
 * Mutates the herbivore in place.
 * Returns { agent, offspring[] }.
 *
 * NOTE: `agents` is the live Map — check .alive before trusting a reference.
 */
function updateHerbivore(herbivore, agents, config) {
  const cfg = config.herbivore;
  const { worldWidth, worldHeight } = config;

  herbivore.age++;
  herbivore.energy -= cfg.energyDecayRate;
  if (herbivore.reproductionCooldown > 0) herbivore.reproductionCooldown--;

  // Death by starvation or old age
  if (herbivore.energy <= 0 || herbivore.age >= cfg.maxLifespan) {
    herbivore.alive = false;
    herbivore.state = 'dead';
    return { agent: herbivore, offspring: [], events: [] };
  }

  const events = [];

  // --- Find food ---
  const plants = [...agents.values()].filter(a => a.type === 'plant' && a.alive);
  const target = findNearest(herbivore, plants, cfg.visionRange);

  if (target) {
    // How far is the plant?
    const dx = target.x - herbivore.x;
    const dy = target.y - herbivore.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= cfg.eatRange) {
      // Eat
      target.alive = false;
      herbivore.energy = Math.min(cfg.maxEnergy, herbivore.energy + config.plant.energyValue);
      herbivore.state = 'eating';
      events.push({ type: 'eat', agentType: 'herbivore', x: target.x, y: target.y });
    } else {
      herbivore.state = 'seeking_food';
      moveToward(herbivore, target, cfg.moveSpeed, worldWidth, worldHeight);
    }
  } else {
    herbivore.state = 'wandering';
    wander(herbivore, cfg.moveSpeed, cfg.wanderTurnRate, worldWidth, worldHeight);
  }

  // --- Reproduction ---
  const offspring = [];
  if (herbivore.energy >= cfg.reproductionThreshold && herbivore.reproductionCooldown === 0) {
    herbivore.energy -= cfg.reproductionCost;
    herbivore.reproductionCooldown = cfg.reproductionCooldown;
    herbivore.state = 'reproducing';
    events.push({ type: 'reproduce', agentType: 'herbivore', x: herbivore.x, y: herbivore.y });

    const child = createHerbivore(
      clamp(herbivore.x + (Math.random() - 0.5) * 30, 0, worldWidth),
      clamp(herbivore.y + (Math.random() - 0.5) * 30, 0, worldHeight),
      config,
    );
    child.energy = Math.floor(cfg.reproductionCost * cfg.offspringEnergyRatio);
    offspring.push(child);
  }

  return { agent: herbivore, offspring, events };
}

module.exports = { createHerbivore, updateHerbivore };
