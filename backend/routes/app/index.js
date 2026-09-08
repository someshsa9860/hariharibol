// Every mobile-app route family, in one list.
//
// app.js mounts this at /api/app. Reading this file tells you the whole app
// surface without opening anything else — which is the point of keeping routes
// segregated by platform in the first place.

const express = require('express');
const { mount } = require('../../utils/router');

const routers = [
  require('./auth'),
  require('./device'),
  require('./user'),
  require('./home'),
  require('./book'),
  require('./verse'),
  require('./mantra'),
  require('./sadhana'),
  require('./task'),
  require('./sloka'),
  require('./issue'),
  require('./favorite'),
  require('./progress'),
  require('./notification'),
  require('./subscription'),
  require('./donation'),
  require('./reference'),
  require('./search'),
];

module.exports = mount(express.Router(), '/api/app', routers);
