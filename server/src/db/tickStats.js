'use strict';

const { getDb } = require('./schema');

function saveTickStats({ universeId, instanceId, tick, stats }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO tick_stats (universe_id, instance_id, tick, stats, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(universeId, instanceId, tick, JSON.stringify(stats), Date.now());
}

function getTickStats(universeId, { fromTick = 0, limit = 200 } = {}) {
  const db = getDb();
  return db.prepare(`
    SELECT tick, stats, created_at
      FROM tick_stats
     WHERE universe_id = ? AND tick >= ?
     ORDER BY tick ASC
     LIMIT ?
  `).all(universeId, fromTick, limit).map(r => ({ ...r, stats: JSON.parse(r.stats) }));
}

module.exports = { saveTickStats, getTickStats };
