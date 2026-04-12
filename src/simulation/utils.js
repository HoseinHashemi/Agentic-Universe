'use strict';

function distance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Returns the nearest candidate within maxRange, or null. */
function findNearest(agent, candidates, maxRange) {
  let nearest = null;
  let minDist = maxRange + 1;
  for (const c of candidates) {
    const d = distance(agent, c);
    if (d <= maxRange && d < minDist) {
      nearest = c;
      minDist = d;
    }
  }
  return nearest;
}

/** Move agent one step toward target at the given speed. Updates agent.direction. */
function moveToward(agent, target, speed, worldWidth, worldHeight) {
  const dx = target.x - agent.x;
  const dy = target.y - agent.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return;
  agent.direction = Math.atan2(dy, dx);
  agent.x = clamp(agent.x + (dx / dist) * speed, 0, worldWidth);
  agent.y = clamp(agent.y + (dy / dist) * speed, 0, worldHeight);
}

/**
 * Move agent in a slightly randomised straight line.
 * Reflects off world boundaries by flipping the angle component.
 */
function wander(agent, speed, wanderTurnRate, worldWidth, worldHeight) {
  // Occasionally adjust heading
  if (Math.random() < 0.15) {
    agent.direction += (Math.random() - 0.5) * 2 * wanderTurnRate;
  }

  const nextX = agent.x + Math.cos(agent.direction) * speed;
  const nextY = agent.y + Math.sin(agent.direction) * speed;

  // Reflect off walls
  if (nextX <= 0 || nextX >= worldWidth) {
    agent.direction = Math.PI - agent.direction;
  }
  if (nextY <= 0 || nextY >= worldHeight) {
    agent.direction = -agent.direction;
  }

  agent.x = clamp(agent.x + Math.cos(agent.direction) * speed, 0, worldWidth);
  agent.y = clamp(agent.y + Math.sin(agent.direction) * speed, 0, worldHeight);
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

module.exports = { distance, findNearest, moveToward, wander, clamp };
