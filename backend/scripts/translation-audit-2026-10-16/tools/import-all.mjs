// Imports (or with DRY=1 only previews) every Gita language from S3 into the local database; rows stay hidden.
//   cd backend && set -a && source .env && set +a && [DRY=1] [LANGS=bn,te] [OUT=/some/file.json] node scripts/translation-audit-2026-10-16/tools/import-all.mjs
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const B = resolve(import.meta.dirname, '../../..') + '/';
const imp = (p) => import(pathToFileURL(B + p).href);
const { prisma } = await imp('config/database.js');
const { importLanguage } = await imp('services/translation-import.js');
const { s3Store } = await imp('scripts/lib/claude-translate-store.js');
const store = await s3Store();
const dryRun = process.env.DRY === '1';
const out = {};
for (const language of (process.env.LANGS ?? 'bn,hi,kn,ml,mr,ta,te').split(',')) {
  const r = await importLanguage({ language, publish: false, dryRun, store });
  out[language] = r;
  const t = r.totals;
  console.log(`${language}: chapters ${t.chapters}, inStorage ${t.inStorage}, created ${t.created}, updated ${t.updated}, unchanged ${t.unchanged}, noTranslation ${t.noTranslation}, missing ${t.missing}, conflicts ${t.conflicts}, failedChapters ${t.failedChapters}, replacedVisible ${t.replacedVisible}`, JSON.stringify(t.versions));
  for (const c of r.chapters) if (c.error || c.conflicts.length || c.missing.length || !c.found) console.log('   ch', c.chapter, c.error || '', c.conflicts.slice(0, 3), c.missing.slice(0, 3), c.found ? '' : 'NO FILE');
}
if (process.env.OUT) await (await import('node:fs')).promises.writeFile(process.env.OUT, JSON.stringify(out, null, 1));
await prisma.$disconnect();
process.exit(0);
