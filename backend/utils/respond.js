// Every response has the same shape, so the Flutter app and the admin panel can
// each write one parser and be done:
//
//   { "success": true,  "data": …, "meta": … }
//   { "success": false, "error": { "code", "message", "details" } }

function ok(res, data = null, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(200).json(body);
}

function created(res, data = null) {
  return res.status(201).json({ success: true, data });
}

function noContent(res) {
  return res.status(204).send();
}

// `page` is what utils/pagination.js produced, so the caller does not assemble
// the meta block by hand each time.
function paginated(res, items, page) {
  return res.status(200).json({
    success: true,
    data: items,
    meta: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: Math.ceil(page.total / page.pageSize) || 0,
      hasMore: page.page * page.pageSize < page.total,
    },
  });
}

function fail(res, status, code, message, details) {
  return res.status(status).json({ success: false, error: { code, message, details } });
}

module.exports = { ok, created, noContent, paginated, fail };
