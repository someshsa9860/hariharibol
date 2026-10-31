// Running async work a few at a time. No I/O of its own — loaded on its own by `npm test`.

/**
 * Calls `fn` on each of `items`, at most `limit` at once, starting them in order.
 * Resolves when all have finished; the first rejection rejects it, so a caller
 * that wants the rest to go on catches inside `fn` (the push jobs do).
 */
async function eachLimited(items, limit, fn) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const at = next++;
      await fn(items[at], at);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, lane));
}

export { eachLimited };
