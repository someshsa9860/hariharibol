// Writes docs/openapi.json to disk.
//
// For CI, for generating a client, and for diffing the API surface in a pull
// request — a route quietly losing its auth guard shows up as a line in that
// diff, which is easier to notice than reading the code.
//
//   npm run docs:export

const fs = require('node:fs');
const path = require('node:path');

// Loading the route groups is what populates the registry.
require('../routes/app');
require('../routes/web');
require('../routes/admin');
require('../routes/webhook');

const { build } = require('./openapi');
const { registry } = require('../utils/router');

const spec = build();
const target = path.join(__dirname, 'openapi.json');

fs.writeFileSync(target, `${JSON.stringify(spec, null, 2)}\n`);

// eslint-disable-next-line no-console -- this is a CLI script
console.log(
  `Wrote ${target}\n${registry.length} routes across ${Object.keys(spec.paths).length} paths.`
);
process.exit(0);
