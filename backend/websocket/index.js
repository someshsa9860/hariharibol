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
import * as presence from '../services/presence.js';
import { devops } from '../config/devops.js';
import { redis } from '../config/redis.js';

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

// Every socket whose user's role carries `permission` (read once, at connect).
function sendToPermission(permission, event, payload) {
  let count = 0;
  for (const sockets of connections.values()) {
    for (const socket of sockets) {
      if (!socket.permissions?.has(permission)) continue;
      send(socket, event, payload);
      count += 1;
    }
  }
  return count;
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

  // Clients only ever send a small ping frame. Without a cap, `ws` buffers up to 100 MB per message, so one
  // client could fill this container's memory.
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

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

    // The developer companion app says so on its handshake (`?app=dev`) and needs `dev.access`.
    const isDevApp = url.searchParams.get('app') === 'dev';

    let userId;
    let permissions;
    try {
      const payload = authService.verifyAccessToken(token);
      const loaded = await authService.loadAuthUser(payload.sub);
      if (!loaded || loaded.user.isBanned) {
        socket.close(4003, 'Not authorised');
        return;
      }
      userId = loaded.user.id;
      permissions = loaded.permissions;
      if (isDevApp && !permissions.has('dev.access')) {
        socket.close(4003, 'Not authorised');
        return;
      }
    } catch {
      socket.close(4001, 'Invalid token');
      return;
    }

    socket.userId = userId;
    socket.permissions = permissions;
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
        if (message.type === 'ping') {
          send(socket, 'pong', {});
          // The companion app tells us whether it is on screen. While it is, the developer's pushes are held
          // back (services/dev-push.js); the key expires on its own when the app goes quiet.
          if (isDevApp && message.foreground === true) {
            redis.set(`dev:fg:${userId}`, '1', 'EX', devops.PUSH_FOREGROUND_TTL_S).catch(() => {});
          } else if (isDevApp) {
            redis.del(`dev:fg:${userId}`).catch(() => {});
          }
        }
      } catch {
        /* ignore malformed frames */
      }
    });

    socket.on('close', () => {
      if (isDevApp) redis.del(`dev:fg:${userId}`).catch(() => {});
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

  // Live numbers for the admin panel: who is online (seen within five minutes). Every few seconds the set is
  // compared with the last one; a change — or twenty quiet seconds — is pushed to every admin with `system.read` as
  // `presence.update`, with the people who joined or dropped off in between. Nothing is sent when no admin is
  // connected, and a failure here only skips a tick.
  let previous = new Set();
  let lastSent = 0;
  const hasAdmin = () => {
    for (const sockets of connections.values()) for (const s of sockets) if (s.permissions?.has('system.read')) return true;
    return false;
  };
  const presenceTick = setInterval(async () => {
    try {
      if (!hasAdmin()) return;
      const [counts, recent] = await Promise.all([presence.counts(), presence.recent(presence.ONLINE_WINDOW_S, 500)]);
      const now = new Set(recent.map((r) => r.userId));
      const joined = [...now].filter((id) => !previous.has(id));
      const left = [...previous].filter((id) => !now.has(id));
      if (joined.length === 0 && left.length === 0 && Date.now() - lastSent < 20_000) return;
      const people = await presence.describe([...joined, ...left].slice(0, 20));
      const byId = new Map(people.map((u) => [u.id, u]));
      previous = now;
      lastSent = Date.now();
      sendToPermission('system.read', 'presence.update', {
        online: counts[presence.ONLINE_WINDOW_S],
        last15m: counts[900],
        lastHour: counts[3600],
        sockets: connections.size,
        joined: joined.map((id) => byId.get(id)).filter(Boolean).slice(0, 10),
        left: left.map((id) => byId.get(id)).filter(Boolean).slice(0, 10),
        at: Date.now(),
      });
    } catch (err) {
      logger.debug({ err: err.message }, 'presence tick failed');
    }
  }, 5_000);

  // Fan-in from the API containers.
  const subscriber = createClient('subscriber');
  await subscriber.subscribe(channels.userEvent, channels.broadcast, channels.permissionEvent);

  subscriber.on('message', (channel, raw) => {
    try {
      const message = JSON.parse(raw);
      if (channel === channels.userEvent) {
        sendToUser(message.userId, message.event, message.payload);
      } else if (channel === channels.broadcast) {
        broadcast(message.event, message.payload);
      } else if (channel === channels.permissionEvent) {
        sendToPermission(message.permission, message.event, message.payload);
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
    clearInterval(presenceTick);
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
