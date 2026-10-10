// One Prisma client for the whole process. Controllers require this directly —
// there is no repository or data-access layer between a controller and Prisma.

import { PrismaClient } from '@prisma/client';
import env from './env.js';
import * as s3 from '../services/s3.js';
import logger from './logger.js';

const baseClient = new PrismaClient({
  log: env.isDevelopment
    ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
    : ['warn', 'error'],
});

if (env.isDevelopment) {
  baseClient.$on('query', (e) => {
    logger.debug({ ms: e.duration, query: e.query }, 'prisma');
  });
}

// An upload from the app or panel lands in temp/. The moment a row is written
// with such a key, the object is moved to its permanent home and the row stores
// that instead — so no controller has to remember to, and none can forget.
// Any string anywhere in the written data, JSON columns included, is checked.
const WRITES = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert']);

const prisma = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, args, query }) {
        if (WRITES.has(operation) && args) {
          for (const field of ['data', 'create', 'update']) {
            if (args[field] !== undefined) args[field] = await s3.commitKeys(args[field]);
          }
        }
        return query(args);
      },
    },
  },
});

async function connectDatabase() {
  await prisma.$connect();
  logger.info('database connected');
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

export { prisma, connectDatabase, disconnectDatabase };
