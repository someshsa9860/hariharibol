// Fills the translated headings (`Chapter.titleI18n`) of every chapter of Śrīmad-Bhāgavatam — and of
// any other book with a chapter whose heading is missing in a language — in all eleven reading
// languages, with the translation provider (Claude by default). One call per canto per language.
//
//   node scripts/translate-chapter-titles.js --dry-run     what is missing; no model call, no write
//   node scripts/translate-chapter-titles.js               translate and save
//   node scripts/translate-chapter-titles.js --cantos 1,2 --langs hi,ta --provider openai
//
// Reads each chapter's English heading from the database (`titleI18n.en`, else `title`), saves a language only
// where the chapter has none (an admin's edit or an earlier run is never replaced), and writes after every
// canto and language, so a killed run is simply run again. Needs the chapters (scripts/import-sb.js) and
// ANTHROPIC_API_KEY (or OPENAI_API_KEY / GEMINI_API_KEY with --provider). A changed title changes the unit's
// hash: run the book export afterwards. See "Translated titles" in backend/CLAUDE.md.

import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean' }, book: { type: 'string' }, cantos: { type: 'string' }, langs: { type: 'string' },
    provider: { type: 'string' }, model: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  },
});
if (values.help) {
  console.log('Usage: node scripts/translate-chapter-titles.js [--dry-run] [--book srimad-bhagavatam] [--cantos 1,2] [--langs hi,ta] [--provider anthropic|openai|gemini] [--model ID]');
  process.exit(0);
}

const { prisma } = await import('../config/database.js');
const { fillMissing } = await import('../prisma/seed/section-titles/index.js');
const { LANGUAGE_NAMES, translateHeadings } = await import('./lib/chapter-titles.js');
const { createAsk, providerOf } = await import('./lib/translate-providers.js');

const slug = values.book ?? 'srimad-bhagavatam';
const provider = values.provider ?? 'anthropic';
const langs = values.langs ? values.langs.split(',') : Object.keys(LANGUAGE_NAMES);
const bad = langs.filter((code) => !LANGUAGE_NAMES[code]);
if (bad.length) throw new Error(`Unknown language ${bad.join(', ')} — expected ${Object.keys(LANGUAGE_NAMES).join(', ')}`);
const only = values.cantos ? new Set(values.cantos.split(',').map(Number)) : null;

const book = await prisma.book.findUnique({ where: { slug } });
if (!book) throw new Error(`No book "${slug}"`);

const chapters = await prisma.chapter.findMany({
  where: { bookId: book.id },
  orderBy: [{ cantoNumber: 'asc' }, { number: 'asc' }],
  select: { id: true, number: true, cantoNumber: true, title: true, titleI18n: true },
});
if (chapters.length === 0) throw new Error(`"${slug}" has no chapters — run its importer first.`);

const englishOf = (c) => (typeof c.titleI18n?.en === 'string' && c.titleI18n.en.trim()) || c.title;
const cantoOf = (c) => c.cantoNumber ?? 0;
const byCanto = new Map();
for (const c of chapters) {
  if (only && !only.has(cantoOf(c))) continue;
  byCanto.set(cantoOf(c), [...(byCanto.get(cantoOf(c)) ?? []), c]);
}

const hasLang = (c, code) => typeof c.titleI18n?.[code] === 'string' && c.titleI18n[code].trim();
const spent = { usd: 0, calls: 0 };
let saved = 0;
let ask = null;

for (const [canto, rows] of byCanto) {
  for (const code of langs) {
    const todo = rows.filter((c) => !hasLang(c, code));
    if (todo.length === 0) continue;
    if (values['dry-run']) {
      console.log(`canto ${canto} ${code}: ${todo.length} of ${rows.length} chapters to translate`);
      continue;
    }
    if (!ask) {
      const key = process.env[providerOf(provider).keyEnv];
      if (!key) throw new Error(`${providerOf(provider).keyEnv} is not set`);
      ask = createAsk({ provider, apiKey: key, model: values.model || undefined }).ask;
    }
    const titles = await translateHeadings({ ask, code, canto, headings: todo.map(englishOf), spent });
    for (const [i, c] of todo.entries()) {
      // Re-read nothing: only this run writes a Bhagavatam chapter's map, and fillMissing keeps what is there.
      const merged = fillMissing({ en: englishOf(c), ...(c.titleI18n ?? {}) }, { [code]: titles[i] });
      c.titleI18n = merged;
      await prisma.chapter.update({ where: { id: c.id }, data: { titleI18n: merged } });
      saved += 1;
    }
    console.log(`canto ${canto} ${code}: ${todo.length} saved ($${spent.usd.toFixed(3)} so far)`);
  }
}

console.log(values['dry-run'] ? 'Dry run: nothing written.' : `Done: ${saved} titles saved, ${spent.calls} calls, $${spent.usd.toFixed(3)}.`);
await prisma.$disconnect();
