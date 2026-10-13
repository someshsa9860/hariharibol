// Sends the daily sloka push for some verses to one person's own phone, so the
// notification and its picture can be seen arriving. It builds each push the way
// the hourly job does (jobs/processors/sloka.js) and sends it through the same
// FCM service — but writes no Notification row and marks no sloka as delivered.
//
// Usage (from backend/):
//   node scripts/sloka-push-demo.js you@example.com                  the demo verses
//   node scripts/sloka-push-demo.js you@example.com 1.2.47 2.1.1.1   the verses with these ids
//   node scripts/sloka-push-demo.js you@example.com --token <fcm token> …
//
// Needs Firebase credentials (secrets/README.md). The push goes to the devices
// this database has a push token for under that email — and a phone only has one
// here if the app on it signed in against this backend. A phone running against
// another backend (the app defaults to production) has its token there instead;
// `--token` sends to a token read off the phone, which the debug app prints
// ("[push] token …"), whichever backend knows it. The email is still what the
// meaning is read in the language of.
//
// The picture of each verse is drawn and stored in the media bucket first, as it
// would be for a real push — with the AWS keys in a laptop's .env that is the
// real bucket.
//
// On Android the picture shows when the notification is pulled down open and the
// app is not on screen.

import { prisma } from '../config/database.js';
import { redis, publisher } from '../config/redis.js';
import * as firebase from '../services/firebase.js';
import * as fcm from '../services/fcm.js';
import * as slokaCard from '../services/sloka-card.js';
import { loadVerseForPush } from '../jobs/processors/sloka.js';
import { slokaPush } from '../utils/sloka-push.js';

// The verses of scripts/sloka-card-preview.js, so the cards already looked at
// are the ones that arrive. The longest verse is not added: it is cut with "…".
const DEMO_VERSE_IDS = ['1.2.47', '1.18.66', '1.1.1', '2.9.6.22', '2.1.1.1', '2.7.12.26-28'];

// Same as the job's title. Apart so they arrive in order and each can be read.
const TITLE = 'Your sloka for today';
const GAP_MS = 6000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const args = process.argv.slice(2);
  const tokenAt = args.indexOf('--token');
  const token = tokenAt === -1 ? null : args.splice(tokenAt, 2)[1];
  const [email, ...ids] = args;
  if (!email?.includes('@') || (tokenAt !== -1 && !token)) {
    console.error('Usage: node scripts/sloka-push-demo.js <email> [--token <fcm token>] [verse-id …]');
    process.exitCode = 1;
    return;
  }

  // Before anything is drawn or stored: a push that cannot be sent is not worth
  // an upload.
  if (!firebase.isConfigured()) {
    console.error('Firebase is not configured, so no push can be sent. See secrets/README.md.');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, timezone: true, readingLanguage: true, appLanguage: true },
  });
  if (!user) {
    console.error(`No user with the email ${email}.`);
    process.exitCode = 1;
    return;
  }

  const devices = token
    ? 1
    : await prisma.device.count({ where: { userId: user.id, fcmToken: { not: null }, isBanned: false } });
  if (!devices) {
    console.error(
      `${email} has no device with a push token in this database — the phone has signed in against ` +
        'another backend, or not at all. Send to its token with --token (see the top of this file).'
    );
    process.exitCode = 1;
    return;
  }
  console.log(token ? 'Sending to the token given' : `Sending to ${devices} device${devices === 1 ? '' : 's'} of ${email}`);

  const verseIds = ids.length ? ids : DEMO_VERSE_IDS;
  for (const [index, verseId] of verseIds.entries()) {
    const row = await prisma.verse.findUnique({ where: { verseId }, select: { id: true } });
    const verse = row && (await loadVerseForPush(row.id, user));
    if (!verse) {
      console.log(`${verseId}: no such verse`);
      continue;
    }

    const { body, data } = slokaPush({ verse, user });
    const image = await slokaCard.cardUrl(verse);
    const payload = { title: TITLE, body, image, data };
    const result = token ? await fcm.sendToTokens([token], payload) : await fcm.sendToUser(user.id, payload);
    console.log(
      `${verseId}: ${image ? 'with picture' : 'NO picture'}, sent ${result.sent}, failed ${result.failed}`
    );

    if (index < verseIds.length - 1) await sleep(GAP_MS);
  }
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    publisher.disconnect();
  });
