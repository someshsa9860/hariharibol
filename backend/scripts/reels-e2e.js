// Walks the whole reels surface over real HTTP against a running API. Run it
// after `npm run dev` and `npm run seed:reels`:
//
//   npm run test:reels
//
// Same shape as scripts/auth-e2e.js: the session is issued directly, because
// no provider will mint an ID token for a script, and everything after that
// point is the real endpoint over the real transport.
//
// What it is actually checking is the thing that is easy to get wrong and hard
// to notice: **every denormalised counter agreeing with the rows it
// summarises.** likeCount against ReelLike, commentCount against ReelComment,
// followerCount against CreatorFollow. A like that appears in the list but not
// in the number is the bug nobody can reproduce three weeks later, so each one
// is asserted against a fresh count from the database rather than against what
// the response claimed.

import { prisma } from '../config/database.js';
import * as authService from '../services/auth.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const HEAD = {
  'content-type': 'application/json',
  'x-device-id': 'reels-e2e-device',
  'x-platform': 'ios',
};

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(
    `  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`
  );
  if (ok) passed += 1;
  else failed += 1;
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...HEAD, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 204 and friends have no body.
  }
  return { status: res.status, json };
}

// The counters are the point of this script — read them back from the source
// of truth rather than trusting what the endpoint just told us.
const realLikes = (reelId) => prisma.reelLike.count({ where: { reelId } });
const realComments = (reelId) => prisma.reelComment.count({ where: { reelId } });
const cached = (reelId) =>
  prisma.reel.findUnique({
    where: { id: reelId },
    select: { likeCount: true, commentCount: true, shareCount: true, viewCount: true },
  });

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }

  // A reader who is not one of the demo creators, so the feed does not hide
  // everything as "your own".
  const reader = await prisma.user.findFirst({
    where: { creatorProfile: null },
    include: { role: true },
  });
  if (!reader) {
    console.error('\nNo non-creator user to read as. Run `npm run seed` first.\n');
    process.exit(1);
  }
  if ((await prisma.reel.count({ where: { status: 'PUBLISHED' } })) === 0) {
    console.error('\nNo published reels. Run `npm run seed:reels` first.\n');
    process.exit(1);
  }

  const { accessToken: token } = await authService.issueSession(reader, 'reels-e2e-device');
  const as = { token };

  console.log(`\nReading as ${reader.email}`);

  // ── 1 ──────────────────────────────────────────────────────────────────────
  console.log('\n1. The feed');
  const feed = await call('GET', '/api/app/reels', as);
  check('GET /api/app/reels is 200', feed.status === 200, `HTTP ${feed.status}`);
  const reels = feed.json?.data ?? [];
  check('it returned reels', reels.length > 0, `${reels.length}`);
  check('page size defaults to 11', feed.json?.meta?.pageSize === 11, `${feed.json?.meta?.pageSize}`);

  const first = reels[0];
  check('a reel carries its creator', Boolean(first?.creator?.id));
  check('media is signed, not a raw S3 key', !String(first?.videoUrl ?? first?.thumbnailUrl ?? '').startsWith('reels/'));
  check('engagement flags are present', 'isLiked' in (first ?? {}) && 'isSaved' in (first ?? {}));
  check('follow state is present', 'isFollowingCreator' in (first ?? {}));

  const anonymous = await call('GET', '/api/app/reels');
  check('the feed needs a signed-in reader', anonymous.status === 401, `HTTP ${anonymous.status}`);

  const mine = reels.filter((r) => r.isMine);
  check('the feed leaves out my own reels', mine.length === 0, `${mine.length} own reels`);

  // ── 2 ──────────────────────────────────────────────────────────────────────
  console.log('\n2. One reel, the share and deeplink target');
  const one = await call('GET', `/api/app/reels/${first.id}`, as);
  check('GET /api/app/reels/:id is 200', one.status === 200, `HTTP ${one.status}`);
  check('it is the same reel', one.json?.data?.id === first.id);
  const missing = await call('GET', '/api/app/reels/does-not-exist', as);
  check('an unknown id is 404', missing.status === 404, `HTTP ${missing.status}`);

  // ── 3 ──────────────────────────────────────────────────────────────────────
  console.log('\n3. Liking, and the counter that has to keep up');
  await call('DELETE', `/api/app/reels/${first.id}/like`, as); // start from a known state
  const before = (await cached(first.id)).likeCount;

  const liked = await call('POST', `/api/app/reels/${first.id}/like`, as);
  check('POST /like is 200', liked.status === 200, `HTTP ${liked.status}`);
  check('it reports liked', liked.json?.data?.isLiked === true);
  check('the count went up by one', liked.json?.data?.likeCount === before + 1, `${before} → ${liked.json?.data?.likeCount}`);

  const twice = await call('POST', `/api/app/reels/${first.id}/like`, as);
  check('liking twice is not an error', twice.status === 200, `HTTP ${twice.status}`);
  check('and does not double-count', twice.json?.data?.likeCount === before + 1, `${twice.json?.data?.likeCount}`);
  check(
    'the cached count matches the rows',
    (await cached(first.id)).likeCount === (await realLikes(first.id)),
    `cached ${(await cached(first.id)).likeCount} vs rows ${await realLikes(first.id)}`
  );

  const unliked = await call('DELETE', `/api/app/reels/${first.id}/like`, as);
  check('DELETE /like is 200', unliked.status === 200, `HTTP ${unliked.status}`);
  check('the count came back down', unliked.json?.data?.likeCount === before, `${unliked.json?.data?.likeCount}`);
  const unlikedTwice = await call('DELETE', `/api/app/reels/${first.id}/like`, as);
  check('unliking twice does not go negative', unlikedTwice.json?.data?.likeCount === before, `${unlikedTwice.json?.data?.likeCount}`);

  // ── 4 ──────────────────────────────────────────────────────────────────────
  console.log('\n4. Watch tracking');
  await prisma.reelView.deleteMany({ where: { userId: reader.id, reelId: first.id } });
  const viewsBefore = (await cached(first.id)).viewCount;

  const skimmed = await call('POST', `/api/app/reels/${first.id}/view`, { ...as, body: { watchedMs: 800 } });
  check('a sub-3s swipe does not count', skimmed.json?.data?.counted === false);
  check('and viewCount did not move', (await cached(first.id)).viewCount === viewsBefore);

  const watched = await call('POST', `/api/app/reels/${first.id}/view`, {
    ...as,
    body: { watchedMs: 7600, durationMs: 8000 },
  });
  check('a real watch counts', watched.json?.data?.counted === true);
  check('it is marked completed at ~90%', watched.json?.data?.completed === true);
  check('viewCount went up by one', (await cached(first.id)).viewCount === viewsBefore + 1);

  await call('POST', `/api/app/reels/${first.id}/view`, { ...as, body: { watchedMs: 7600, durationMs: 8000 } });
  check('a rewatch does not inflate viewCount', (await cached(first.id)).viewCount === viewsBefore + 1, `${(await cached(first.id)).viewCount}`);
  const view = await prisma.reelView.findUnique({
    where: { userId_reelId: { userId: reader.id, reelId: first.id } },
  });
  check('but it does bump watchCount', view?.watchCount === 2, `${view?.watchCount}`);

  const partial = await call('POST', `/api/app/reels/${first.id}/view`, { ...as, body: { watchedMs: 4000, durationMs: 8000 } });
  check('a later partial rewatch does not un-complete it', partial.json?.data?.counted === true);
  const stillDone = await prisma.reelView.findUnique({
    where: { userId_reelId: { userId: reader.id, reelId: first.id } },
  });
  check('completed stays true', stillDone?.completed === true);

  // ── 5 ──────────────────────────────────────────────────────────────────────
  console.log('\n5. Comments');
  const commentsBefore = (await cached(first.id)).commentCount;

  const posted = await call('POST', '/api/app/reel-comments', {
    ...as,
    body: { reelId: first.id, text: 'Hari bol — posted by the e2e script.' },
  });
  check('POST /reel-comments is 201', posted.status === 201, `HTTP ${posted.status}`);
  const comment = posted.json?.data;
  check('it comes back with its author', Boolean(comment?.author?.id));
  check('and is marked as mine', comment?.isMine === true);
  check('the reel commentCount went up', (await cached(first.id)).commentCount === commentsBefore + 1);

  const empty = await call('POST', '/api/app/reel-comments', { ...as, body: { reelId: first.id, text: '   ' } });
  check('an empty comment is refused', empty.status === 400, `HTTP ${empty.status}`);

  const listed = await call('GET', `/api/app/reel-comments?reelId=${first.id}`, as);
  check('GET /reel-comments is 200', listed.status === 200, `HTTP ${listed.status}`);
  check('the new comment is in the list', (listed.json?.data ?? []).some((c) => c.id === comment.id));
  check('comments default to 20 a page', listed.json?.meta?.pageSize === 20, `${listed.json?.meta?.pageSize}`);

  console.log('\n6. Replies, and the one-level rule');
  const reply = await call('POST', '/api/app/reel-comments', {
    ...as,
    body: { reelId: first.id, parentId: comment.id, text: 'Replying to my own comment.' },
  });
  check('a reply is 201', reply.status === 201, `HTTP ${reply.status}`);
  check('it hangs off the parent', reply.json?.data?.parentId === comment.id);

  const nested = await call('POST', '/api/app/reel-comments', {
    ...as,
    body: { reelId: first.id, parentId: reply.json.data.id, text: 'Replying to the reply.' },
  });
  check('a reply to a reply is accepted', nested.status === 201, `HTTP ${nested.status}`);
  check(
    'but flattened onto the same parent',
    nested.json?.data?.parentId === comment.id,
    `parentId ${nested.json?.data?.parentId === comment.id ? 'flattened' : nested.json?.data?.parentId}`
  );

  const replies = await call('GET', `/api/app/reel-comments?reelId=${first.id}&parentId=${comment.id}`, as);
  check('replies list under the parent', (replies.json?.data ?? []).length === 2, `${(replies.json?.data ?? []).length}`);
  check('replies page at 10', replies.json?.meta?.pageSize === 10, `${replies.json?.meta?.pageSize}`);
  const parentRow = await prisma.reelComment.findUnique({ where: { id: comment.id } });
  check('the parent replyCount kept up', parentRow?.replyCount === 2, `${parentRow?.replyCount}`);

  console.log('\n7. Liking a comment');
  const cLiked = await call('POST', `/api/app/reel-comments/${comment.id}/like`, as);
  check('POST /like is 200', cLiked.status === 200, `HTTP ${cLiked.status}`);
  check('the count moved', cLiked.json?.data?.likeCount === 1, `${cLiked.json?.data?.likeCount}`);
  const cLikedTwice = await call('POST', `/api/app/reel-comments/${comment.id}/like`, as);
  check('twice does not double-count', cLikedTwice.json?.data?.likeCount === 1, `${cLikedTwice.json?.data?.likeCount}`);
  await call('DELETE', `/api/app/reel-comments/${comment.id}/like`, as);
  check('unliking returns to zero', (await prisma.reelComment.findUnique({ where: { id: comment.id } }))?.likeCount === 0);

  console.log('\n8. Deleting a comment takes its replies with it');
  const beforeDelete = (await cached(first.id)).commentCount;
  const removed = await call('DELETE', `/api/app/reel-comments/${comment.id}`, as);
  check('DELETE is 204', removed.status === 204, `HTTP ${removed.status}`);
  check(
    'the count dropped by the whole subtree',
    (await cached(first.id)).commentCount === beforeDelete - 3,
    `${beforeDelete} → ${(await cached(first.id)).commentCount}`
  );
  check(
    'and the cached count matches the rows',
    (await cached(first.id)).commentCount === (await realComments(first.id)),
    `cached ${(await cached(first.id)).commentCount} vs rows ${await realComments(first.id)}`
  );

  const someoneElses = await prisma.reelComment.findFirst({ where: { userId: { not: reader.id } } });
  if (someoneElses) {
    const refused = await call('DELETE', `/api/app/reel-comments/${someoneElses.id}`, as);
    check("someone else's comment cannot be deleted", refused.status === 403, `HTTP ${refused.status}`);
  }

  // ── 9 ──────────────────────────────────────────────────────────────────────
  console.log('\n9. Sharing and saving');
  const sharesBefore = (await cached(first.id)).shareCount;
  const shared = await call('POST', `/api/app/reels/${first.id}/share`, { ...as, body: { platform: 'WHATSAPP' } });
  check('POST /share is 200', shared.status === 200, `HTTP ${shared.status}`);
  check('shareCount moved', shared.json?.data?.shareCount === sharesBefore + 1);
  check(
    'the share was logged with its platform',
    Boolean(await prisma.reelShare.findFirst({ where: { reelId: first.id, platform: 'WHATSAPP' } }))
  );

  await prisma.favorite.deleteMany({ where: { userId: reader.id, reelId: first.id } });
  const saved = await call('POST', '/api/app/favorites', { ...as, body: { reelId: first.id } });
  check('a reel can be saved as a favourite', saved.status === 201, `HTTP ${saved.status}`);
  const savedList = await call('GET', '/api/app/reels/saved', as);
  check('GET /reels/saved is 200', savedList.status === 200, `HTTP ${savedList.status}`);
  check('the saved reel is in it', (savedList.json?.data ?? []).some((r) => r.id === first.id));
  const refetched = await call('GET', `/api/app/reels/${first.id}`, as);
  check('and the reel reports itself saved', refetched.json?.data?.isSaved === true);

  // ── 10 ─────────────────────────────────────────────────────────────────────
  console.log('\n10. Reporting');
  await prisma.reelReport.deleteMany({ where: { reporterId: reader.id } });
  const reported = await call('POST', `/api/app/reels/${first.id}/report`, {
    ...as,
    body: { reason: 'NON_DEVOTIONAL', note: 'e2e' },
  });
  check('POST /report is 201', reported.status === 201, `HTTP ${reported.status}`);
  check('it is a fresh report', reported.json?.data?.alreadyReported === false);
  const again = await call('POST', `/api/app/reels/${first.id}/report`, { ...as, body: { reason: 'SPAM' } });
  check('reporting again returns the open one', again.json?.data?.alreadyReported === true);
  check('rather than writing a second', (await prisma.reelReport.count({ where: { reporterId: reader.id, reelId: first.id } })) === 1);
  const badReason = await call('POST', `/api/app/reels/${first.id}/report`, { ...as, body: { reason: 'NOT_A_REASON' } });
  check('an unknown reason is a 400', badReason.status === 400, `HTTP ${badReason.status}`);

  // ── 11 ─────────────────────────────────────────────────────────────────────
  console.log('\n11. Creators and following');
  const creatorId = first.creator.id;
  await call('DELETE', `/api/app/creators/${creatorId}/follow`, as);
  const profile = await call('GET', `/api/app/creators/${creatorId}`, as);
  check('GET /creators/:id is 200', profile.status === 200, `HTTP ${profile.status}`);
  check('it is not following yet', profile.json?.data?.isFollowing === false);
  const followersBefore = profile.json?.data?.followerCount ?? 0;

  const followed = await call('POST', `/api/app/creators/${creatorId}/follow`, as);
  check('POST /follow is 200', followed.status === 200, `HTTP ${followed.status}`);
  check('followerCount moved', followed.json?.data?.followerCount === followersBefore + 1);
  const followedTwice = await call('POST', `/api/app/creators/${creatorId}/follow`, as);
  check('following twice does not double-count', followedTwice.json?.data?.followerCount === followersBefore + 1);
  check(
    'the cached count matches the rows',
    (await prisma.creatorProfile.findUnique({ where: { id: creatorId } }))?.followerCount ===
      (await prisma.creatorFollow.count({ where: { creatorId } })),
    'followerCount vs CreatorFollow'
  );

  const following = await call('GET', '/api/app/creators', as);
  check('the creator shows in my following list', (following.json?.data ?? []).some((c) => c.id === creatorId));

  const creatorReels = await call('GET', `/api/app/creators/${creatorId}/reels`, as);
  check('GET /creators/:id/reels is 200', creatorReels.status === 200, `HTTP ${creatorReels.status}`);
  check('they are all that creator’s', (creatorReels.json?.data ?? []).every((r) => r.creator.id === creatorId));

  const feedAfter = await call('GET', '/api/app/reels', as);
  const sameReel = (feedAfter.json?.data ?? []).find((r) => r.id === first.id);
  check('the feed now reports the follow', sameReel ? sameReel.isFollowingCreator === true : true);

  await call('DELETE', `/api/app/creators/${creatorId}/follow`, as);
  check(
    'unfollowing settles the count back',
    (await prisma.creatorProfile.findUnique({ where: { id: creatorId } }))?.followerCount === followersBefore
  );

  // ── 12 ─────────────────────────────────────────────────────────────────────
  console.log('\n12. Every counter, against the rows it summarises');
  const all = await prisma.reel.findMany({
    select: { id: true, likeCount: true, commentCount: true, shareCount: true },
  });
  let drift = 0;
  for (const reel of all) {
    const [likes, comments, shares] = await Promise.all([
      realLikes(reel.id),
      realComments(reel.id),
      prisma.reelShare.count({ where: { reelId: reel.id } }),
    ]);
    if (likes !== reel.likeCount || comments !== reel.commentCount || shares !== reel.shareCount) {
      drift += 1;
      console.log(
        `        drift on ${reel.id}: likes ${reel.likeCount}/${likes}, ` +
          `comments ${reel.commentCount}/${comments}, shares ${reel.shareCount}/${shares}`
      );
    }
  }
  check('no reel has a counter that drifted', drift === 0, `${all.length} reels checked`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
