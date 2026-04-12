'use strict';

const { getAdminToken } = require('../db/users');

function auth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || token !== getAdminToken()) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

module.exports = auth;
