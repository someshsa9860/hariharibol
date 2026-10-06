// Express 4 does not catch rejected promises from an async handler — it hangs
// instead. Every route goes through this so a thrown error always reaches the
// error middleware. utils/router.js applies it automatically.

export default function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
