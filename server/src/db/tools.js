'use strict';

const { getDb } = require('./schema');
const { v4: uuidv4 } = require('uuid');

function saveTool(data) {
  const db = getDb();
  const id = data.id || ('tool_' + uuidv4().slice(0, 8));
  const now = Date.now();
  const existing = db.prepare('SELECT id FROM tools WHERE name = ?').get(data.name);
  if (existing) {
    db.prepare(`UPDATE tools SET description=?, input_schema=?, output_schema=?,
      implementation=?, implemented=?, async=?, sandboxed=? WHERE name=?`
    ).run(
      data.description,
      JSON.stringify(data.input_schema),
      JSON.stringify(data.output_schema),
      data.implementation || '',
      data.implemented !== false ? 1 : 0,
      data.async ? 1 : 0,
      data.sandboxed !== false ? 1 : 0,
      data.name
    );
    return getTool(data.name);
  }
  db.prepare(`
    INSERT INTO tools (id,name,category,description,input_schema,output_schema,
      implementation,implemented,async,sandboxed,origin_universe,origin_agent,created_at,use_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)
  `).run(
    id, data.name, data.category, data.description,
    JSON.stringify(data.input_schema),
    JSON.stringify(data.output_schema),
    data.implementation || '',
    data.implemented !== false ? 1 : 0,
    data.async ? 1 : 0,
    data.sandboxed !== false ? 1 : 0,
    data.origin_universe || null,
    data.origin_agent || null,
    now
  );
  return getTool(data.name);
}

function getTool(nameOrId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tools WHERE name = ? OR id = ?').get(nameOrId, nameOrId);
  return row ? _deserialize(row) : null;
}

function listTools({ implemented } = {}) {
  const db = getDb();
  if (implemented !== undefined) {
    return db.prepare('SELECT * FROM tools WHERE implemented = ? ORDER BY category, name')
      .all(implemented ? 1 : 0).map(_deserialize);
  }
  return db.prepare('SELECT * FROM tools ORDER BY category, name').all().map(_deserialize);
}

function incrementUseCount(name) {
  getDb().prepare('UPDATE tools SET use_count = use_count + 1 WHERE name = ?').run(name);
}

function _deserialize(row) {
  return {
    ...row,
    input_schema: JSON.parse(row.input_schema),
    output_schema: JSON.parse(row.output_schema),
    async: !!row.async,
    sandboxed: !!row.sandboxed,
    implemented: !!row.implemented,
  };
}

module.exports = { saveTool, getTool, listTools, incrementUseCount };
