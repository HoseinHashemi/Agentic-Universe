'use strict';

const { saveUniverse, getUniverse, listUniverses, deleteUniverse } = require('./universes');
const { ensureAdminUser, getAdminToken, ADMIN_ID } = require('./users');
const agents   = require('./agents');
const sessions = require('./sessions');

module.exports = {
  saveUniverse, getUniverse, listUniverses, deleteUniverse,
  ensureAdminUser, getAdminToken, ADMIN_ID,
  ...agents,
  ...sessions,
};
