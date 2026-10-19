// `next build` with `output: 'standalone'` leaves server.js without the static files and the public folder; the
// server expects them beside it. This puts them there, so `.next/standalone` is the whole deployable site.
import { cp, access } from 'node:fs/promises';

const exists = (path) => access(path).then(() => true, () => false);

if (await exists('.next/standalone')) {
  await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
  if (await exists('public')) await cp('public', '.next/standalone/public', { recursive: true });
  console.log('standalone: static files and public/ copied into .next/standalone');
}
