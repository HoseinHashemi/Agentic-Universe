'use strict';

const { v4: uuidv4 } = require('uuid');
const { clamp } = require('../utils');

function createPlant(x, y) {
  return {
    id: uuidv4(),
    type: 'plant',
    x,
    y,
    energy: 0,   // plants provide energy; they don't consume it
    age: 0,
    alive: true,
    reproductionCooldown: 0,
    direction: 0,
    state: 'idle',
    memory: {},
  };
}

/** Tick a plant forward by one step. Returns the (mutated) plant. */
function updatePlant(plant) {
  plant.age++;
  return plant;
}

/**
 * Possibly spawn one new plant this tick.
 * Returns an array containing the new plant, or an empty array.
 */
function spawnPlants(agents, config) {
  const { worldWidth, worldHeight, plant: cfg } = config;
  const livePlants = [...agents.values()].filter(a => a.type === 'plant' && a.alive);

  if (livePlants.length >= cfg.maxCount) return [];
  if (Math.random() >= cfg.spawnRate) return [];

  let x, y;
  if (livePlants.length > 0 && Math.random() < cfg.clusterBias) {
    const parent = livePlants[Math.floor(Math.random() * livePlants.length)];
    x = clamp(parent.x + (Math.random() - 0.5) * 2 * cfg.clusterRadius, 0, worldWidth);
    y = clamp(parent.y + (Math.random() - 0.5) * 2 * cfg.clusterRadius, 0, worldHeight);
  } else {
    x = Math.random() * worldWidth;
    y = Math.random() * worldHeight;
  }

  return [createPlant(x, y)];
}

module.exports = { createPlant, updatePlant, spawnPlants };
