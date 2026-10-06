// The websocket container.
//
// Holds the open connections; the API does not. The API publishes to Redis
// (services/websocket.js) and whichever instance of this process is holding a
// given user's socket picks it up and writes it down the wire.
//
// That indirection is the reason both sides scale independently. It also means
// a websocket container restarting drops connections and nothing else — no
// message is lost that mattered, because anything durable was already written
// as a Notification row and pushed through FCM.
//
// Connections authenticate with the same access token as the API. There is one
// auth service, and a socket is not a way around it.

import http from 'node:http';
import { WebSocketServer } from 'ws';

import env from '../config/env.js';
import logger from '../config/logger.js';
import { createClient, channels } from '../config/redis.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import * as authService from '../services/auth.js';

// userId → Set of live sockets. One person may have several: a phone, a tablet,
// the website open in a tab.
const connections = new Map();

const HEARTBEAT_MS = 30_000;

function add(userId, socket) {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId).add(socket);
}

function remove(userId, socket) {
  const sockets = connections.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) connections.delete(userId);
}

function send(socket, event, payload) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify({ event, payload, at: Date.now() }));
}

function sendToUser(userId, event, payload) {
  const sockets = connections.get(userId);
  if (!sockets) return 0;
  for (const socket of sockets) send(socket, event, payload);
  return sockets.size;
}

function broadcast(event, payload) {
  let count = 0;
  for (const sockets of connections.values()) {
    for (const socket of sockets) {
      send(socket, event, payload);
      count += 1;
    }
  }
  return count;
}

async function start() {
  await connectDatabase();

  const server = http.createServer((req, res) => {
    // The container needs a health endpoint of its own — a load balancer cannot
    // health-check a websocket handshake.
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, connections: connections.size }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (socket, request) => {
    // The token arrives on the URL rather than in a header: browsers give no
    // way to set headers on a WebSocket handshake. It is the same short-lived
    // access token, and the connection is refused without a valid one.
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.close(4001, 'Token required');
      return;
    }

    let userId;
    try {
      const payload = authService.verifyAccessToken(token);
      const loaded = await authService.loadAuthUser(payload.sub);
      if (!loaded || loaded.user.isBanned) {
        socket.close(4003, 'Not authorised');
        return;
      }
      userId = loaded.user.id;
    } catch {
      socket.close(4001, 'Invalid token');
      return;
    }

    socket.userId = userId;
    socket.isAlive = true;
    add(userId, socket);

    logger.info({ userId, total: connections.size }, 'socket connected');
    send(socket, 'connected', { userId });

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', (raw) => {
      // The socket is one-way by design. Everything a client wants to *do* goes
      // through the HTTP API, where the validation, rate limits and audit trail
      // already live — duplicating that here would mean two doors to keep shut.
      try {
        const message = JSON.parse(raw);
        if (message.type === 'ping') send(socket, 'pong', {});
      } catch {
        /* ignore malformed frames */
      }
    });

    socket.on('close', () => {
      remove(userId, socket);
      logger.debug({ userId }, 'socket closed');
    });

    socket.on('error', (err) => {
      logger.warn({ userId, err: err.message }, 'socket error');
    });
  });

  // A socket whose network vanished stays "open" forever without this — the TCP
  // connection is gone but nothing told us, and the map fills with dead entries.
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (!client.isAlive) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, HEARTBEAT_MS);

  // Fan-in from the API containers.
  const subscriber = createClient('subscriber');
  await subscriber.subscribe(channels.userEvent, channels.broadcast);

  subscriber.on('message', (channel, raw) => {
    try {
      const message = JSON.parse(raw);
      if (channel === channels.userEvent) {
        sendToUser(message.userId, message.event, message.payload);
      } else if (channel === channels.broadcast) {
        broadcast(message.event, message.payload);
      }
    } catch (err) {
      logger.warn({ err: err.message, channel }, 'bad message on redis channel');
    }
  });

  server.listen(env.WS_PORT, () => {
    logger.info({ port: env.WS_PORT }, 'websocket server listening');
  });

  const shutdown = async () => {
    clearInterval(heartbeat);
    wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
    await subscriber.quit();
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  logger.error({ err }, 'websocket server failed to start');
  process.exit(1);
});
