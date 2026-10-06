import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/system.js';

const router = createRouter({
  tag: 'Admin · System',
  prefix: '/system',
  description: 'Server health, storage and product analytics — is the box OK, and what are people doing.',
});

router.get(
  '/health',
  {
    summary: 'Get process, OS and database vitals',
    permission: 'system.read',
    limit: 'read',
    responds: { 200: 'Memory, load and database size' },
  },
  controller.health
);

router.get(
  '/storage',
  {
    summary: 'Get media storage size by kind',
    description: 'Bytes and object count per upload kind — cached ten minutes, a full listing is not free.',
    permission: 'system.read',
    limit: 'read',
    responds: { 200: 'Storage summary' },
  },
  controller.storage
);

router.get(
  '/logs',
  {
    summary: 'Get recent log lines from this process',
    description: 'An in-memory ring buffer, not a log aggregator — empties on restart, and only covers the API process.',
    permission: 'system.read',
    limit: 'read',
    query: z.object({ limit: z.coerce.number().int().min(1).max(500).optional() }),
    responds: { 200: 'Recent log lines, newest last' },
  },
  controller.logs
);

router.get(
  '/requests',
  {
    summary: 'Get recent request latency and status codes',
    description: 'Read from the same log ring buffer as /logs, filtered to completed HTTP requests — not a second tracking system.',
    permission: 'system.read',
    limit: 'read',
    responds: { 200: 'Recent requests, a latency summary, and the slowest ones' },
  },
  controller.requests
);

router.get(
  '/analytics',
  {
    summary: 'Get active-user counts and content engagement',
    description: 'DAU/WAU/MAU, a 30-day Sadhana activity trend, and the most-chanted mantras and most-viewed reels.',
    permission: 'system.read',
    limit: 'read',
    responds: { 200: 'Analytics summary' },
  },
  controller.analytics
);

export default router;
