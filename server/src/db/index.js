'use strict';

const { saveUniverse, getUniverse, listUniverses, deleteUniverse } = require('./universes');
const { ensureAdminUser, getAdminToken, ADMIN_ID } = require('./users');

module.exports = {
  saveUniverse, getUniverse, listUniverses, deleteUniverse,
  ensureAdminUser, getAdminToken, ADMIN_ID,
};
