// Which mantras a reader can open.
//
// A catalogue mantra is `isPublished`. A mantra a reader added is PRIVATE and stays `isPublished = false`, so every
// query in the codebase that lists "published mantras" leaves it out without knowing it exists. The few that serve a
// reader their own mantras add this on top (`AND: [visibleTo(user)]`), and see both kinds.

/** A Prisma `where` for the mantras `user` may open: the published ones, and the private ones they hold access to. */
export const visibleTo = (user) =>
  user
    ? { OR: [{ isPublished: true }, { mantraType: 'PRIVATE', access: { some: { userId: user.id } } }] }
    : { isPublished: true };

/** The same rule for a mantra already loaded with `access` (the reader's own row only): can `user` open it? */
export const canOpen = (mantra, user) =>
  Boolean(mantra) &&
  (mantra.isPublished || (mantra.mantraType === 'PRIVATE' && Boolean(user) && (mantra.access ?? []).some((row) => row.userId === user.id)));
