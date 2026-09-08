// Every admin route family. Mounted by app.js at /api/admin.
//
// There is no separate admin login. Admins sign in through the same
// /api/app/auth/social endpoint as everyone else — one users table, one auth
// service — and reach these routes only if their role carries the permission
// each one names.

import express from 'express';

import { mount } from '../../utils/router.js';

import dashboardRoutes from './dashboard.js';
import userRoutes from './user.js';
import deviceRoutes from './device.js';
import roleRoutes from './role.js';
import permissionRoutes from './permission.js';
import bookRoutes from './book.js';
import verseRoutes from './verse.js';
import mantraRoutes from './mantra.js';
import referenceRoutes from './reference.js';
import slokaRoutes from './sloka.js';
import paymentRoutes from './payment.js';
import notificationRoutes from './notification.js';
import settingRoutes from './setting.js';
import aiRoutes from './ai.js';
import auditRoutes from './audit.js';
import uploadRoutes from './upload.js';
import jobRoutes from './job.js';

const routers = [
  dashboardRoutes,
  userRoutes,
  deviceRoutes,
  roleRoutes,
  permissionRoutes,
  bookRoutes,
  verseRoutes,
  mantraRoutes,
  referenceRoutes,
  slokaRoutes,
  paymentRoutes,
  notificationRoutes,
  settingRoutes,
  aiRoutes,
  auditRoutes,
  uploadRoutes,
  jobRoutes,
];

export default mount(express.Router(), '/api/admin', routers);
