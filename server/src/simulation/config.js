'use strict';

const DEFAULT_CONFIG = {
  worldWidth: 800,
  worldHeight: 600,
  tickInterval: 200,        // ms between simulation ticks
  snapshotInterval: 50,     // save DB snapshot every N ticks

  initialPlants: 50,
  initialHerbivores: 20,
  initialCarnivores: 5,

  plant: {
    spawnRate: 0.15,        // probability per tick that a new plant spawns
    maxCount: 120,          // hard cap on simultaneous plants
    energyValue: 30,        // energy an herbivore gains by eating one plant
    clusterRadius: 60,      // radius around an existing plant for clustered spawning
    clusterBias: 0.65,      // probability that a new plant spawns near an existing one
  },

  herbivore: {
    initialEnergy: 80,
    maxEnergy: 150,
    energyDecayRate: 1,     // energy lost per tick
    moveSpeed: 2.5,         // pixels per tick
    eatRange: 10,           // distance at which herbivore can eat a plant
    reproductionThreshold: 120,
    reproductionCost: 50,
    reproductionCooldown: 40, // ticks before can reproduce again
    offspringEnergyRatio: 0.5, // fraction of reproductionCost given to child
    maxLifespan: 500,
    visionRange: 100,
    wanderTurnRate: 0.25,   // max radians of random turn per tick while wandering
  },

  carnivore: {
    initialEnergy: 100,
    maxEnergy: 200,
    energyDecayRate: 1.5,
    moveSpeed: 3.5,
    eatRange: 12,
    reproductionThreshold: 160,
    reproductionCost: 70,
    reproductionCooldown: 60,
    offspringEnergyRatio: 0.5,
    maxLifespan: 600,
    visionRange: 150,
    wanderTurnRate: 0.2,
  },
};

/**
 * Deep-merge `overrides` into `base`.  Arrays are replaced, not merged.
 */
function mergeConfig(base, overrides) {
  const result = { ...base };
  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] !== null &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      typeof base[key] === 'object'
    ) {
      result[key] = mergeConfig(base[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

module.exports = { DEFAULT_CONFIG, mergeConfig };
