// Provider callbacks. Mounted by app.js at /api/webhooks.
//
// A fourth group alongside app, web and admin, because these belong to none of
// them: the caller is Razorpay, Google or Apple, and they authenticate by
// signature rather than by a bearer token. Filing them under one of the three
// platforms would put a route in a directory nobody would think to look in.

const express = require('express');
const { mount } = require('../../utils/router');

const routers = [require('./payment')];

module.exports = mount(express.Router(), '/api/webhooks', routers);
