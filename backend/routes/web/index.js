// Every website route family. Mounted by app.js at /api/web.

import express from 'express';

import { mount } from '../../utils/router.js';

import contentRoutes from './content.js';
import pageRoutes from './page.js';

const routers = [
  contentRoutes,
  pageRoutes,
];

export default mount(express.Router(), '/api/web', routers);
