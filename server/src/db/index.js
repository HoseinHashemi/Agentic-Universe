'use strict';

const { saveUniverse, getUniverse, listUniverses, deleteUniverse } = require('./universes');
const { ensureAdminUser, getAdminToken, ADMIN_ID } = require('./users');
const agents    = require('./agents');
const sessions  = require('./sessions');
const events    = require('./events');
const messages  = require('./messages');
const artifacts = require('./artifacts');
const tools     = require('./tools');

module.exports = {
  saveUniverse, getUniverse, listUniverses, deleteUniverse,
  ensureAdminUser, getAdminToken, ADMIN_ID,
  ...agents, ...sessions, ...events, ...messages, ...artifacts, ...tools,
};
