// Every admin route family. Mounted by app.js at /api/admin.
//
// There is no separate admin login. Admins sign in through the same
// /api/app/auth/social endpoint as everyone else — one users table, one auth
// service — and reach these routes only if their role carries the permission
// each one names.

const express = require('express');
const { mount } = require('../../utils/router');

const routers = [
  require('./dashboard'),
  require('./user'),
  require('./device'),
  require('./role'),
  require('./permission'),
  require('./book'),
  require('./verse'),
  require('./mantra'),
  require('./reference'),
  require('./sloka'),
  require('./payment'),
  require('./notification'),
  require('./setting'),
  require('./ai'),
  require('./audit'),
  require('./upload'),
  require('./job'),
];

module.exports = mount(express.Router(), '/api/admin', routers);
