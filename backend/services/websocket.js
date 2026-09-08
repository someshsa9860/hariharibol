// The API container does not hold websocket connections — the websocket/
// container does, and it runs separately (backend/CLAUDE.md rule 8). So this is
// the publish half: a controller calls `toUser()`, the message goes onto a
// Redis channel, and whichever websocket container holds that user's socket
// picks it up and writes it down the wire.
//
// That indirection is what makes both sides scale independently. It also means
// publishing never fails a request: if no websocket container is listening, the
// message is simply not delivered, and the notification row and the push are
// already handling durability.

const { publisher, channels } = require('../config/redis');
const logger = require('../config/logger');

function publish(channel, message) {
  publisher
    .publish(channel, JSON.stringify(message))
    .catch((err) => logger.warn({ err: err.message, channel }, 'websocket publish failed'));
}

// To one user, on every device they have open.
function toUser(userId, event, payload) {
  publish(channels.userEvent, { userId, event, payload, at: Date.now() });
}

// To everyone currently connected.
function broadcast(event, payload) {
  publish(channels.broadcast, { event, payload, at: Date.now() });
}

// The events the app knows how to handle. Listed so both sides of the wire
// agree on the names without one of them guessing.
const EVENTS = {
  NOTIFICATION: 'notification',
  SLOKA_READY: 'sloka.ready',
  CHANT_PROGRESS: 'chant.progress',
  ENTITLEMENT_CHANGED: 'entitlement.changed',
  ANNOUNCEMENT: 'announcement',
};

module.exports = { toUser, broadcast, EVENTS };
