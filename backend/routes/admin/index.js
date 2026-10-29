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
import creatorRoutes from './creator.js';
import supportRoutes from './support.js';
import reelRoutes from './reel.js';
import reelRecipeRoutes from './reel-recipe.js';
import referenceRoutes from './reference.js';
import slokaRoutes from './sloka.js';
import paymentRoutes from './payment.js';
import financeRoutes from './finance.js';
import planRoutes from './plan.js';
import notificationRoutes from './notification.js';
import settingRoutes from './setting.js';
import aiRoutes from './ai.js';
import auditRoutes from './audit.js';
import uploadRoutes from './upload.js';
import jobRoutes from './job.js';
import translationRoutes from './translation.js';
import sceneRoutes from './scene.js';
import etiquetteRoutes from './etiquette.js';
import bookCacheRoutes from './book-cache.js';
import systemRoutes from './system.js';
import chatRoutes from './chat.js';
import panchangRoutes from './panchang.js';
import calendarTranslationRoutes from './calendar-translation.js';
import maintenanceRoutes from './maintenance.js';
import devRoutes from './dev.js';
import marketingRoutes from './marketing.js';
import marketingTemplateRoutes from './marketing-template.js';
import marketingAudienceRoutes from './marketing-audience.js';

const routers = [
  dashboardRoutes,
  userRoutes,
  deviceRoutes,
  roleRoutes,
  permissionRoutes,
  bookRoutes,
  verseRoutes,
  mantraRoutes,
  creatorRoutes,
  supportRoutes,
  reelRoutes,
  reelRecipeRoutes,
  referenceRoutes,
  slokaRoutes,
  paymentRoutes,
  financeRoutes,
  planRoutes,
  notificationRoutes,
  settingRoutes,
  aiRoutes,
  auditRoutes,
  uploadRoutes,
  jobRoutes,
  translationRoutes,
  sceneRoutes,
  etiquetteRoutes,
  bookCacheRoutes,
  systemRoutes,
  chatRoutes,
  panchangRoutes,
  calendarTranslationRoutes,
  maintenanceRoutes,
  devRoutes,
  marketingRoutes,
  marketingTemplateRoutes,
  marketingAudienceRoutes,
];

export default mount(express.Router(), '/api/admin', routers);
