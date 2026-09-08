// Every website route family. Mounted by app.js at /api/web.

const express = require('express');
const { mount } = require('../../utils/router');

const routers = [require('./content'), require('./page')];

module.exports = mount(express.Router(), '/api/web', routers);
