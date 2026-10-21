// Pure helpers behind the push statistics — no database, so they test on their own.

// Senders that go to many people one at a time (the daily sloka, a reminder) name
// no campaign, and land on one per kind of message per day.
export function defaultKey(type, now = new Date()) {
  return `${type.toLowerCase()}:${now.toISOString().slice(0, 10)}`;
}

/**
 * The funnel from raw numbers. A device that opened a push obviously received it,
 * so `delivered` counts devices that reported either — a notification the system
 * drew while the app was closed never runs app code, only its tap does.
 */
export function funnel({ sent, delivered, opened, engaged, readers, totalStayMs }) {
  const rate = (n, of) => (of > 0 ? Math.round((n / of) * 1000) / 10 : null);
  return {
    sent,
    delivered,
    opened,
    engaged,
    deliveredRate: rate(delivered, sent),
    openedRate: rate(opened, sent),
    engagedRate: rate(engaged, opened),
    averageStaySeconds: readers > 0 ? Math.round(totalStayMs / readers / 100) / 10 : null,
  };
}

