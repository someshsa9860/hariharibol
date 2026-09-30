import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../config/constants.js';

// Reads ?page= and ?pageSize= into Prisma's skip/take, clamped so a caller
// cannot ask for the whole table. `defaultPageSize` lets a feed with its own
// natural batch size (the reel feed's 11) override the general default without
// every caller having to pass `pageSize` just to get it.
function readPage(query = {}, defaultPageSize = PAGE_SIZE_DEFAULT) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.pageSize, 10) || defaultPageSize;
  const pageSize = Math.min(Math.max(1, requested), PAGE_SIZE_MAX);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// Turns ?sort=<column>&dir=asc|desc into a Prisma orderBy. `columns` is the
// whitelist a list declares for itself — sort key → the field it orders by, with
// dots for a relation ('role.name', 'translations._count') — so a caller can only
// sort by something the list chose to offer, never by an arbitrary field name.
// With no (or an unknown) sort, `fallback` is the list's natural order.
//
// A sort key is rarely unique — a hundred users can share a role — and paging
// through an unstable order repeats some rows and skips others. So every
// explicit sort ends with the primary key as a tiebreaker.
function readSort(query = {}, columns = {}, fallback, tiebreaker = 'id') {
  const path = Object.hasOwn(columns, query.sort) ? columns[query.sort] : null;
  if (!path) return fallback;

  const dir = query.dir === 'desc' ? 'desc' : 'asc';
  const nest = (parts) => (parts.length === 1 ? { [parts[0]]: dir } : { [parts[0]]: nest(parts.slice(1)) });
  const primary = nest(path.split('.'));

  return path === tiebreaker ? [primary] : [primary, { [tiebreaker]: 'asc' }];
}

// Runs the list and the count together — two round trips become one.
async function paginate(model, { where, orderBy, include, select, query }) {
  const { page, pageSize, skip, take } = readPage(query);
  const [items, total] = await Promise.all([
    model.findMany({ where, orderBy, include, select, skip, take }),
    model.count({ where }),
  ]);
  return { items, page: { page, pageSize, total } };
}

export { readPage, readSort, paginate };
