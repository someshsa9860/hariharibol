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
  // open — one FCM refuses fails the whole send, and an invalid-argument
  // failure reads as a dead token below, so callers pass only https links.
  if (!hasActions) message.notification = { title, body, ...(image ? { imageUrl: image } : {}) };
  return message;
}

export { buildMessage };
