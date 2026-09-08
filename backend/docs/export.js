// Writes docs/openapi.json to disk.
//
// For CI, for generating a client, and for diffing the API surface in a pull
// request — a route quietly losing its auth guard shows up as a line in that
// diff, which is easier to notice than reading the code.
//
//   npm run docs:export

import fs from 'node:fs';
import path from 'node:path';

// Imported for their side effect: loading a route group is what registers
// its routes, and the registry is what the spec is built from.
import '../routes/app/index.js';
import '../routes/web/index.js';
import '../routes/admin/index.js';
import '../routes/webhook/index.js';

import { build } from './openapi.js';
import { registry } from '../utils/router.js';

const spec = build();
const target = path.join(import.meta.dirname, 'openapi.json');

fs.writeFileSync(target, `${JSON.stringify(spec, null, 2)}\n`);

// eslint-disable-next-line no-console -- this is a CLI script
console.log(
  `Wrote ${target}\n${registry.length} routes across ${Object.keys(spec.paths).length} paths.`
);
process.exit(0);
