'use strict';

const { v4: uuidv4 } = require('uuid');

// ── Schema helpers ────────────────────────────────────────────────────────────

function mergeUniverseConfig(base, overrides) {
  if (!overrides || typeof overrides !== 'object') return base;
  const result = { ...base, ...overrides };

  // Merge agentTypes by id (patch individual entries; keep others)
  if (overrides.agentTypes && Array.isArray(overrides.agentTypes)) {
    result.agentTypes = base.agentTypes.map(existing => {
      const patch = overrides.agentTypes.find(t => t.id === existing.id);
      return patch ? { ...existing, ...patch } : existing;
    });
  }
  return result;
}

function validateUniverseConfig(cfg) {
  const errors = [];
  if (!cfg.name?.trim()) errors.push('name is required');
  if (!cfg.worldWidth || cfg.worldWidth < 100) errors.push('worldWidth must be ≥ 100');
  if (!cfg.worldHeight || cfg.worldHeight < 100) errors.push('worldHeight must be ≥ 100');
  if (!Array.isArray(cfg.agentTypes) || cfg.agentTypes.length === 0)
    errors.push('at least one agentType required');

  const typeIds = new Set((cfg.agentTypes || []).map(t => t.id));

  for (const t of (cfg.agentTypes || [])) {
    if (!t.id) errors.push('each agentType must have an id');
    if (!t.name?.trim()) errors.push(`agentType ${t.id}: name required`);
    if (!['producer', 'consumer', 'predator'].includes(t.role))
      errors.push(`agentType ${t.id}: role must be producer|consumer|predator`);
    for (const eatId of (t.eats || [])) {
      if (!typeIds.has(eatId))
        errors.push(`agentType ${t.id}: eats references unknown typeId "${eatId}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ── Default values for new agent types ────────────────────────────────────────

function defaultAgentType(role = 'consumer') {
  return {
    id: 'type_' + uuidv4().slice(0, 8),
    name: role === 'producer' ? 'Plants' : role === 'predator' ? 'Predator' : 'Consumer',
    color: role === 'producer' ? '#4dff91' : role === 'predator' ? '#ff6b35' : '#5aadff',
    role,
    initialCount: role === 'producer' ? 50 : role === 'predator' ? 5 : 20,
    maxCount: role === 'producer' ? 120 : 150,
    initialEnergy: role === 'producer' ? 0 : 80,
    maxEnergy: role === 'producer' ? 0 : 150,
    energyDecayRate: role === 'producer' ? 0 : 1,
    energyValue: role === 'producer' ? 30 : 40,
    speed: role === 'producer' ? 0 : role === 'predator' ? 3.5 : 2.5,
    visionRange: role === 'producer' ? 0 : role === 'predator' ? 150 : 100,
    eatRange: role === 'producer' ? 0 : 10,
    wanderTurnRate: role === 'producer' ? 0 : 0.25,
    reproductionThreshold: role === 'producer' ? 0 : role === 'predator' ? 160 : 120,
    reproductionCost: role === 'producer' ? 0 : role === 'predator' ? 70 : 50,
    reproductionCooldown: role === 'producer' ? 0 : role === 'predator' ? 60 : 40,
    offspringEnergyRatio: 0.5,
    maxLifespan: role === 'producer' ? 0 : role === 'predator' ? 600 : 500,
    spawnRate: role === 'producer' ? 0.15 : 0,
    clusterBias: role === 'producer' ? 0.65 : 0,
    clusterRadius: role === 'producer' ? 60 : 0,
    eats: [],
  };
}

// ── Built-in templates ─────────────────────────────────────────────────────────

const TEMPLATES = {
  'simple-ecosystem': {
    id: 'simple-ecosystem',
    name: 'Simple Ecosystem',
    description: 'A classic three-level food chain. Plants feed herbivores, herbivores feed carnivores.',
    worldWidth: 800, worldHeight: 600, tickInterval: 200, snapshotInterval: 50,
    agentTypes: [
      { id: 'plant', name: 'Plants', color: '#4dff91', role: 'producer',
        initialCount: 50, maxCount: 120, initialEnergy: 0, maxEnergy: 0,
        energyDecayRate: 0, energyValue: 30, speed: 0, visionRange: 0, eatRange: 0,
        wanderTurnRate: 0, reproductionThreshold: 0, reproductionCost: 0,
        reproductionCooldown: 0, offspringEnergyRatio: 0, maxLifespan: 0,
        spawnRate: 0.15, clusterBias: 0.65, clusterRadius: 60, eats: [] },
      { id: 'herbivore', name: 'Herbivores', color: '#5aadff', role: 'consumer',
        initialCount: 20, maxCount: 150, initialEnergy: 80, maxEnergy: 150,
        energyDecayRate: 1, energyValue: 40, speed: 2.5, visionRange: 100, eatRange: 10,
        wanderTurnRate: 0.25, reproductionThreshold: 120, reproductionCost: 50,
        reproductionCooldown: 40, offspringEnergyRatio: 0.5, maxLifespan: 500,
        spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: ['plant'] },
      { id: 'carnivore', name: 'Carnivores', color: '#ff6b35', role: 'predator',
        initialCount: 5, maxCount: 50, initialEnergy: 100, maxEnergy: 200,
        energyDecayRate: 1.5, energyValue: 60, speed: 3.5, visionRange: 150, eatRange: 12,
        wanderTurnRate: 0.2, reproductionThreshold: 160, reproductionCost: 70,
        reproductionCooldown: 60, offspringEnergyRatio: 0.5, maxLifespan: 600,
        spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: ['herbivore'] },
    ],
  },

  'aggressive-universe': {
    id: 'aggressive-universe',
    name: 'Aggressive Universe',
    description: 'Fast, hungry carnivores dominate. Apex predators hunt everything. Survival is brutal.',
    worldWidth: 800, worldHeight: 600, tickInterval: 200, snapshotInterval: 50,
    agentTypes: [
      { id: 'plant', name: 'Plants', color: '#4dff91', role: 'producer',
        initialCount: 60, maxCount: 140, initialEnergy: 0, maxEnergy: 0,
        energyDecayRate: 0, energyValue: 25, speed: 0, visionRange: 0, eatRange: 0,
        wanderTurnRate: 0, reproductionThreshold: 0, reproductionCost: 0,
        reproductionCooldown: 0, offspringEnergyRatio: 0, maxLifespan: 0,
        spawnRate: 0.2, clusterBias: 0.5, clusterRadius: 80, eats: [] },
      { id: 'herbivore', name: 'Herbivores', color: '#7bd4ff', role: 'consumer',
        initialCount: 30, maxCount: 180, initialEnergy: 80, maxEnergy: 140,
        energyDecayRate: 1.2, energyValue: 50, speed: 3, visionRange: 90, eatRange: 10,
        wanderTurnRate: 0.3, reproductionThreshold: 110, reproductionCost: 45,
        reproductionCooldown: 30, offspringEnergyRatio: 0.5, maxLifespan: 400,
        spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: ['plant'] },
      { id: 'carnivore', name: 'Carnivores', color: '#ff6b35', role: 'predator',
        initialCount: 15, maxCount: 80, initialEnergy: 120, maxEnergy: 220,
        energyDecayRate: 2.5, energyValue: 70, speed: 5, visionRange: 160, eatRange: 14,
        wanderTurnRate: 0.15, reproductionThreshold: 170, reproductionCost: 80,
        reproductionCooldown: 50, offspringEnergyRatio: 0.5, maxLifespan: 500,
        spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: ['herbivore'] },
      { id: 'apex', name: 'Apex Predators', color: '#ff2255', role: 'predator',
        initialCount: 3, maxCount: 15, initialEnergy: 150, maxEnergy: 280,
        energyDecayRate: 3, energyValue: 90, speed: 6, visionRange: 200, eatRange: 16,
        wanderTurnRate: 0.1, reproductionThreshold: 220, reproductionCost: 100,
        reproductionCooldown: 80, offspringEnergyRatio: 0.5, maxLifespan: 700,
        spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: ['herbivore', 'carnivore'] },
    ],
  },

  'scarce-universe': {
    id: 'scarce-universe',
    name: 'Scarce Universe',
    description: 'Plants regrow extremely slowly. Every calorie matters. Most species will struggle to survive.',
    worldWidth: 800, worldHeight: 600, tickInterval: 200, snapshotInterval: 50,
    agentTypes: [
      { id: 'plant', name: 'Sparse Plants', color: '#2dcc70', role: 'producer',
        initialCount: 30, maxCount: 60, initialEnergy: 0, maxEnergy: 0,
        energyDecayRate: 0, energyValue: 15, speed: 0, visionRange: 0, eatRange: 0,
        wanderTurnRate: 0, reproductionThreshold: 0, reproductionCost: 0,
        reproductionCooldown: 0, offspringEnergyRatio: 0, maxLifespan: 0,
        spawnRate: 0.03, clusterBias: 0.4, clusterRadius: 100, eats: [] },
      { id: 'herbivore', name: 'Grazers', color: '#5aadff', role: 'consumer',
        initialCount: 15, maxCount: 80, initialEnergy: 70, maxEnergy: 120,
        energyDecayRate: 1.5, energyValue: 35, speed: 2, visionRange: 120, eatRange: 10,
        wanderTurnRate: 0.3, reproductionThreshold: 100, reproductionCost: 45,
        reproductionCooldown: 50, offspringEnergyRatio: 0.5, maxLifespan: 400,
        spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: ['plant'] },
      { id: 'carnivore', name: 'Hunters', color: '#ff8c42', role: 'predator',
        initialCount: 3, maxCount: 30, initialEnergy: 90, maxEnergy: 160,
        energyDecayRate: 2, energyValue: 50, speed: 3, visionRange: 130, eatRange: 12,
        wanderTurnRate: 0.2, reproductionThreshold: 130, reproductionCost: 60,
        reproductionCooldown: 70, offspringEnergyRatio: 0.5, maxLifespan: 500,
        spawnRate: 0, clusterBias: 0, clusterRadius: 0, eats: ['herbivore'] },
    ],
  },
};

module.exports = { TEMPLATES, mergeUniverseConfig, validateUniverseConfig, defaultAgentType };
