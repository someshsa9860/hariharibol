const { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } = require('../config/constants');

// Reads ?page= and ?pageSize= into Prisma's skip/take, clamped so a caller
// cannot ask for the whole table.
function readPage(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.pageSize, 10) || PAGE_SIZE_DEFAULT;
  const pageSize = Math.min(Math.max(1, requested), PAGE_SIZE_MAX);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
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

module.exports = { readPage, paginate };
