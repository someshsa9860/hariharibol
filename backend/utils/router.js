// A thin wrapper over express.Router that makes three project rules impossible
// to forget:
//
//   1. Every endpoint is documented (backend/CLAUDE.md rule 9). The description
//      is an argument to the route, not a separate file that drifts out of date
//      — an undocumented route cannot be written.
//   2. Every endpoint is authenticated unless it says `public: true`
//      (rule 5). Forgetting to guard a route is not possible; forgetting to
//      *un*guard one shows up the first time it is called.
//   3. Input is validated before the controller runs, and lands on
//      `req.valid` — controllers never read raw `req.body`.
//
// It is not a framework. It registers handlers on an express Router and keeps a
// list of what it registered so docs/openapi.js can read it.

import express from 'express';
import { z } from 'zod';
import asyncHandler from './asyncHandler.js';
import { unauthorized, forbidden, badRequest, paymentRequired } from './errors.js';
import * as limiters from '../middleware/rateLimit.js';

// Everything registered anywhere in the app, in registration order. docs reads
// this after routes/index.js has loaded.
const registry = [];

const METHODS = ['get', 'post', 'patch', 'put', 'delete'];

function validate(meta) {
  if (!meta.params && !meta.query && !meta.body) return null;
  return (req, res, next) => {
    const result = {};
    for (const part of ['params', 'query', 'body']) {
      const schema = meta[part];
      if (!schema) {
        result[part] = req[part];
        continue;
      }
      const parsed = schema.safeParse(req[part]);
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => ({
          field: i.path.join('.') || part,
          message: i.message,
        }));
        return next(badRequest(`Invalid ${part}`, details));
      }
      result[part] = parsed.data;
    }
    // Assigned rather than mutating req.query, which is a getter in express.
    req.valid = result;
    return next();
  };
}

function guard(meta) {
  return (req, res, next) => {
    if (meta.public) return next();

    const auth = req.auth || {};
    if (!auth.user) return next(unauthorized());
    if (auth.user.isBanned) return next(forbidden('This account is banned'));

    if (meta.permission) {
      const needed = Array.isArray(meta.permission) ? meta.permission : [meta.permission];
      const has = needed.every((slug) => auth.permissions.has(slug));
      if (!has) return next(forbidden(`Missing permission: ${needed.join(', ')}`));
    }

    // Premium is read from the cached flag on User; entitlement is recomputed
    // by the payment webhooks and the nightly sweep, never here.
    if (meta.premium && !auth.user.isPremium) return next(paymentRequired());

    // A named feature is decided by the user's plan, so it needs the plan —
    // one lookup, only on the routes that ask for it.
    if (meta.feature) {
      // Imported here, not at the top: entitlement pulls in auth and the websocket,
      // and the router is loaded before any of them.
      return import('../services/entitlement.js')
        .then((entitlement) => entitlement.can(auth.user.id, meta.feature))
        .then((allowed) => next(allowed ? undefined : paymentRequired()))
        .catch(next);
    }

    return next();
  };
}

function createRouter(options = {}) {
  const { tag, prefix = '', description } = options;
  const router = express.Router({ mergeParams: true });

  router.meta = { tag, prefix, description, routes: [] };

  for (const method of METHODS) {
    const original = router[method].bind(router);

    router[method] = (path, meta, handler) => {
      if (typeof meta === 'function') {
        throw new Error(
          `${method.toUpperCase()} ${prefix}${path} is missing its documentation object. ` +
            'Every endpoint must be documented — see backend/CLAUDE.md rule 9.'
        );
      }
      if (!meta || !meta.summary) {
        throw new Error(`${method.toUpperCase()} ${prefix}${path} needs a "summary".`);
      }
      if (typeof handler !== 'function') {
        throw new Error(`${method.toUpperCase()} ${prefix}${path} has no handler.`);
      }

      const chain = [];
      if (meta.limit) chain.push(limiters.get(meta.limit));
      chain.push(guard(meta));
      const validator = validate(meta);
      if (validator) chain.push(validator);
      if (meta.middleware) chain.push(...[].concat(meta.middleware));
      chain.push(asyncHandler(handler));

      original(path, ...chain);

      const entry = { method, path, meta, tag, prefix, fullPath: null };
      router.meta.routes.push(entry);
      registry.push(entry);
      return router;
    };
  }

  return router;
}

// Mounts a group of routers under one prefix and records the full path each
// route ended up at, so the docs show the URL a client actually calls.
function mount(parent, groupPrefix, routers) {
  for (const router of routers) {
    const routerPrefix = router.meta?.prefix || '';
    parent.use(routerPrefix, router);
    for (const entry of router.meta?.routes || []) {
      const joined = `${groupPrefix}${routerPrefix}${entry.path}`.replace(/\/+$/, '') || '/';
      entry.fullPath = joined.replace(/\/{2,}/g, '/');
      entry.group = groupPrefix;
    }
  }
  return parent;
}

// Common param schemas, so twenty route files do not each define their own.
const schemas = {
  id: z.object({ id: z.string().min(1) }),
  slug: z.object({ slug: z.string().min(1) }),
  page: z.object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    q: z.string().trim().min(1).max(200).optional(),
  }),
  // A page plus ?sort=&dir= — `columns` is the list's own sort whitelist (the
  // keys of the map its controller hands to readSort), so the docs show exactly
  // which columns can be sorted.
  sorted: (columns) =>
    schemas.page.extend({
      sort: z.enum(Object.keys(columns)).optional(),
      dir: z.enum(['asc', 'desc']).optional(),
    }),
  // A yes/no query filter. z.coerce.boolean() is wrong for query strings —
  // Boolean('false') is true, so ?isBanned=false would return the banned users.
  flag: z.enum(['true', 'false']).transform((value) => value === 'true'),
};

export { createRouter, mount, registry, schemas, z };
