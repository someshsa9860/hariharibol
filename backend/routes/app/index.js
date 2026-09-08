// Every mobile-app route family, in one list.
//
// app.js mounts this at /api/app. Reading this file tells you the whole app
// surface without opening anything else — which is the point of keeping routes
// segregated by platform in the first place.

import express from 'express';

import { mount } from '../../utils/router.js';

import authRoutes from './auth.js';
import deviceRoutes from './device.js';
import userRoutes from './user.js';
import homeRoutes from './home.js';
import bookRoutes from './book.js';
import verseRoutes from './verse.js';
import mantraRoutes from './mantra.js';
import sadhanaRoutes from './sadhana.js';
import taskRoutes from './task.js';
import slokaRoutes from './sloka.js';
import issueRoutes from './issue.js';
import favoriteRoutes from './favorite.js';
import progressRoutes from './progress.js';
import notificationRoutes from './notification.js';
import subscriptionRoutes from './subscription.js';
import donationRoutes from './donation.js';
import referenceRoutes from './reference.js';
import searchRoutes from './search.js';

const routers = [
  authRoutes,
  deviceRoutes,
  userRoutes,
  homeRoutes,
  bookRoutes,
  verseRoutes,
  mantraRoutes,
  sadhanaRoutes,
  taskRoutes,
  slokaRoutes,
  issueRoutes,
  favoriteRoutes,
  progressRoutes,
  notificationRoutes,
  subscriptionRoutes,
  donationRoutes,
  referenceRoutes,
  searchRoutes,
];

export default mount(express.Router(), '/api/app', routers);
