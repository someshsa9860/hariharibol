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

import { publisher, channels } from '../config/redis.js';
import logger from '../config/logger.js';

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

// To everyone connected whose role carries `permission` — the admin panel's live pages, which
// must not be broadcast to the app's users.
function toPermission(permission, event, payload) {
  publish(channels.permissionEvent, { permission, event, payload, at: Date.now() });
}

// The events the app knows how to handle. Listed so both sides of the wire
// agree on the names without one of them guessing.
const EVENTS = {
  NOTIFICATION: 'notification',
  SLOKA_READY: 'sloka.ready',
  CHANT_PROGRESS: 'chant.progress',
  ENTITLEMENT_CHANGED: 'entitlement.changed',
  ANNOUNCEMENT: 'announcement',
  // Admin panel, to `translation.read`: a run's whole state, and one line of its activity feed.
  TRANSLATION_RUN: 'translation.run',
  TRANSLATION_ACTIVITY: 'translation.activity',
  // Admin panel, to `translation.import`: the same two for a translation import run.
  TRANSLATION_IMPORT_RUN: 'translation-import.run',
  TRANSLATION_IMPORT_ACTIVITY: 'translation-import.activity',
  // Admin panel, to `scenes.read`: the same two for the scene prompt runs.
  SCENES_RUN: 'scenes.run',
  SCENES_ACTIVITY: 'scenes.activity',
  SCENES_USAGE: 'scenes.usage',
  // Admin panel, to `etiquette.translate`: the same two for the devotee etiquette translation runs.
  ETIQUETTE_RUN: 'etiquette.run',
  ETIQUETTE_ACTIVITY: 'etiquette.activity',
  // Admin panel, to `panchang.translate`: the same two for the Hindu calendar translation runs.
  CALENDAR_RUN: 'calendar.run',
  CALENDAR_ACTIVITY: 'calendar.activity',
  // Admin panel, to `marketing.read`: a campaign's whole state, and one line of its activity feed.
  MARKETING_RUN: 'marketing.run',
  MARKETING_ACTIVITY: 'marketing.activity',
};

export { toUser, broadcast, toPermission, EVENTS };
