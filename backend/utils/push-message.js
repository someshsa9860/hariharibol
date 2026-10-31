// The FCM message for one push. Pure, so `npm test` loads it on its own.

// `importance` picks the Android channel and priority; `hasActions` means the
// message carries action buttons. FCM cannot draw buttons itself, so Android then
// gets a data-only message (title, body and picture ride in `data`) that the app
// draws with its own buttons; iOS still gets a normal alert, and its notification
// service extension adds the picture and the buttons.
function buildMessage({ title, body, image, data, importance = 'urgent', hasActions = false }) {
  // FCM data values must all be strings — a number here fails the whole send.
  const strings = Object.fromEntries(
    Object.entries(data || {}).map(([key, value]) => [key, String(value ?? '')])
  );
  const urgent = importance !== 'quiet';

  const message = {
    data: hasActions
      ? { ...strings, title: String(title ?? ''), body: String(body ?? ''), ...(image ? { image } : {}) }
      : strings,
    android: {
      priority: urgent ? 'high' : 'normal',
      ...(hasActions ? {} : { notification: { channelId: urgent ? 'default' : 'updates' } }),
    },
    apns: {
      headers: { 'apns-priority': urgent ? '10' : '5' },
      payload: {
        aps: {
          sound: 'default',
          // The service extension downloads the picture and sets the buttons.
          ...(image || hasActions ? { 'mutable-content': 1 } : {}),
          ...(hasActions ? { alert: { title, body } } : {}),
        },
      },
      ...(image ? { fcmOptions: { imageUrl: image } } : {}),
    },
  };

  // `imageUrl` is the big picture on Android. It must be a link a phone can
  // open — one FCM refuses fails the whole send (`invalid-argument` for every
  // device, logged as a malformed message), so callers pass only https links.
  if (!hasActions) message.notification = { title, body, ...(image ? { imageUrl: image } : {}) };
  return message;
}

// Firebase says the token is dead. Keeping it means retrying a delivery that
// can never land, on every send, forever.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// `invalid-argument` is usually the message, not the device: a picture link FCM
// will not fetch, a data value that is too long. Clearing tokens on it wiped the
// devices of everyone a bad push went to. FCM also answers it for a token that is
// not a token at all, and says so in the message — only that one is dead.
const NOT_A_TOKEN = /registration token/i;

/** Whether an FCM send error (`{ code, message }`) means the device's token can be dropped. */
function isDeadToken(error) {
  if (DEAD_TOKEN_CODES.has(error?.code)) return true;
  return error?.code === 'messaging/invalid-argument' && NOT_A_TOKEN.test(error.message || '');
}

export { buildMessage, isDeadToken };
