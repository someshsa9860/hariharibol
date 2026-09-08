// One Prisma client for the whole process. Controllers require this directly —
// there is no repository or data-access layer between a controller and Prisma.

const { PrismaClient } = require('@prisma/client');
const env = require('./env');
const logger = require('./logger');

const prisma = new PrismaClient({
  log: env.isDevelopment
    ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
    : ['warn', 'error'],
});

if (env.isDevelopment) {
  prisma.$on('query', (e) => {
    logger.debug({ ms: e.duration, query: e.query }, 'prisma');
  });
}

async function connectDatabase() {
  await prisma.$connect();
  logger.info('database connected');
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

module.exports = { prisma, connectDatabase, disconnectDatabase };
