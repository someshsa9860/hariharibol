// The servers a phone or browser needs to find a path to another person for a WebRTC call.
//
// STUN only tells a client its own public address. TURN relays the audio when no direct path
// exists. TURN passwords are the time-limited kind coturn understands (`use-auth-secret`):
// the username is an expiry timestamp and the password an HMAC of it, so nothing a client
// holds works for long and nothing fixed is ever sent to one.

import crypto from 'node:crypto';

import env from '../config/env.js';

export function iceServers(userId) {
  const servers = [];
  if (env.stunUrls.length) servers.push({ urls: env.stunUrls });

  if (env.turnUrls.length && env.TURN_SECRET) {
    const expires = Math.floor(Date.now() / 1000) + env.TURN_TTL_SECONDS;
    const username = `${expires}:${userId}`;
    const credential = crypto.createHmac('sha1', env.TURN_SECRET).update(username).digest('base64');
    servers.push({ urls: env.turnUrls, username, credential });
  }

  return servers;
}
