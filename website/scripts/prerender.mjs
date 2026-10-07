// Writes the page's HTML into dist/index.html, so the site is readable by
// search engines, link previews and slow phones before any JavaScript runs.
// Runs last in `npm run build`, after `vite build` made dist/ and
// `vite build --ssr` made dist-server/entry-server.js.
import { readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const indexPath = path.join(root, 'dist/index.html');
const serverEntry = path.join(root, 'dist-server/entry-server.js');
const emptyRoot = '<div id="root"></div>';

const { render } = await import(pathToFileURL(serverEntry).href);
const template = await readFile(indexPath, 'utf8');
if (!template.includes(emptyRoot)) throw new Error(`${emptyRoot} not found in dist/index.html`);

await writeFile(indexPath, template.replace(emptyRoot, `<div id="root">${render()}</div>`));
await rm(path.join(root, 'dist-server'), { recursive: true });
console.log('Prerendered dist/index.html');
