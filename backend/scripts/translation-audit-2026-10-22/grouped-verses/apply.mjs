// Applies plan.json to work/ (a copy of orig/). No S3. Writes work/ files and apply-report.json.
// usage: node apply.mjs            (re-copies orig -> work first, so it can be re-run)
import fs from 'node:fs';
import { SP, LANGS, load, save, row, norm, groupsOf } from './lib.mjs';

const REPO = '/Users/SSS/Jay Jay Ram Krishna Hari/app/hariharibol/backend/scripts/lib';
const { unitsFromChapter, sourceHash } = await import(`${REPO}/claude-translate-source.js`);
const { partHash, mainStampOf, translatedByOf, PARTS } = await import(`${REPO}/claude-translate-parts.js`);

const DATE = '2026-10-22';
const plan = JSON.parse(fs.readFileSync(`${SP}/tools/plan.json`, 'utf8'));
const report = { english: [], langs: [], droppedNotes: [], anomalies: [] };
const anomaly = (m) => { report.anomalies.push(m); console.log('ANOMALY', m); };

// fresh copy of the pristine download
fs.rmSync(`${SP}/work`, { recursive: true, force: true });
fs.cpSync(`${SP}/orig`, `${SP}/work`, { recursive: true });

const stripDash = (s) => s.replace(/\s+[–—-]\s*$/u, '').replace(/[–—]\s*$/u, '').trim();
/** Segments of `text` cut at `offsets` (char offsets = end of every segment but the last). */
function segments(text, offsets) {
  const out = [];
  let at = 0;
  for (const o of [...offsets, text.length]) { out.push(text.slice(at, o)); at = o; }
  const segs = out.map((s) => stripDash(s.trim()));
  // nothing may be lost: the pieces joined equal the source (apart from the stripped dashes and spaces)
  const strip = (s) => s.replace(/[\s–—-]+/gu, '');
  if (strip(segs.join('')) !== strip(text)) throw new Error('segments do not add up to the source');
  for (let i = 0; i < offsets.length; i++) if (!(offsets[i] > (offsets[i - 1] ?? 0) && offsets[i] < text.length)) throw new Error(`bad offsets ${offsets}`);
  if (segs.some((s) => !s)) throw new Error('empty segment');
  return segs;
}

const rowsOf = (v, type) => v.commentaries.filter((x) => x.translatorSlug === 'prabhupada' && x.type === type);
const dropRow = (v, type) => { v.commentaries = v.commentaries.filter((x) => !(x.translatorSlug === 'prabhupada' && x.type === type)); };


const clone = (x) => JSON.parse(JSON.stringify(x));
const nospace = (s) => (s || '').replace(/\s+/g, '');
/** The stamp that speaks for a verse's translation, whichever shape the verse is in (as a parts-stamp). */
function translationStamp(ai) {
  if (ai.parts?.translation) return clone(ai.parts.translation);
  return { provider: ai.provider, model: ai.model, effort: ai.effort, version: ai.version, promptVersion: ai.promptVersion, generatedAt: ai.generatedAt, correctness: ai.partScores?.translation, warnings: (ai.warnings || []).filter((w) => w.startsWith('translation:')) };
}
const provenance = (st) => [translatedByOf(st.provider), st.version, st.provider ?? 'anthropic', st.model, st.effort, st.promptVersion].join('/');
/** Parts of a legacy-shaped verse, as mergeEntry's legacyParts makes them. */
function legacyPartsOf(v, ai) {
  const has = {
    translation: rowsOf(v, 'translation').some((c) => c.text?.trim()),
    purport: rowsOf(v, 'purport').some((c) => c.text?.trim()),
    transliteration: typeof v.transliteration === 'string' && v.transliteration.trim().length > 0,
    wordMeanings: Array.isArray(v.wordMeanings) && v.wordMeanings.length > 0,
  };
  return Object.fromEntries(PARTS.filter((p) => has[p]).map((p) => [p, { provider: ai.provider, model: ai.model, effort: ai.effort, version: ai.version, promptVersion: ai.promptVersion, generatedAt: ai.generatedAt, correctness: ai.partScores?.[p], warnings: [] }]));
}
/** summarise() of claude-translate-run.js */
function summarise(parts, hash) {
  const names = PARTS.filter((p) => parts[p]);
  const newest = names.map((p) => parts[p]).sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)))[0];
  const main = mainStampOf(parts);
  const notes = [...new Set(names.map((p) => parts[p].note).filter(Boolean))];
  return {
    translatedBy: translatedByOf(main.provider), version: main.version, provider: main.provider, model: main.model, effort: main.effort, promptVersion: main.promptVersion,
    sourceHash: hash, generatedAt: newest.generatedAt,
    correctness: Math.min(...names.map((p) => parts[p].correctness ?? 3)),
    partScores: Object.fromEntries(names.map((p) => [p, parts[p].correctness])),
    ...(notes.length ? { note: notes.join(' · ') } : {}),
    warnings: names.flatMap((p) => parts[p].warnings || []),
    parts: Object.fromEntries(names.map((p) => [p, parts[p]])),
  };
}

const changed = {}; // `${lang}:${c}` -> Set of verseIds changed
const mark = (lang, c, id) => { (changed[`${lang}:${c}`] ??= new Set()).add(id); };

for (let c = 1; c <= 18; c++) {
  const enOrig = load(`${SP}/orig`, 'en', c);
  const en = load(`${SP}/work`, 'en', c);
  const sa = load(`${SP}/orig`, 'sa', c);
  const groups = groupsOf(enOrig);
  if (!groups.length) continue;
  const oldUnits = new Map(unitsFromChapter(enOrig, sa).units.map((u) => [u.verseId, u]));

  // ---------- English ----------
  const enById = new Map(en.verses.map((v) => [v.verseId, v]));
  for (const g of groups) {
    const key = `${c}.${g.verses[0].verseNumber}`;
    const p = plan[key];
    const ids = g.verses.map((v) => v.verseId);
    if (JSON.stringify(ids) !== JSON.stringify(p.verseIds)) throw new Error(`${key}: group verses changed since the plan`);
    const vs = ids.map((id) => enById.get(id));
    const text = row(vs[0], 'translation').text;
    const purp = row(vs[vs.length - 1], 'purport')?.text;
    for (const v of vs) {
      if (norm(row(v, 'translation').text) !== norm(text)) report.anomalies.push(`en ${v.verseId}: translation differs from the group's (wording ${nospace(row(v,'translation').text)===nospace(text)?'same':'DIFFERENT'})`);
      const pp = row(v, 'purport')?.text;
      if (pp != null && purp != null && nospace(pp) !== nospace(purp)) anomaly(`en ${v.verseId}: purport differs from the last verse's`);
      else if (pp != null && purp != null && pp !== purp) report.anomalies.push(`en ${v.verseId}: purport differs from the last verse's in spacing only; the last verse's is kept`);
      if (rowsOf(v, 'translation').length !== 1) anomaly(`en ${v.verseId}: ${rowsOf(v, 'translation').length} translation rows`);
    }
    // The official page has one text for the group; when the verses' copies differ (6.13-14 has an Oxford comma in the
    // first), the last verse's copy is the official one, and the cuts are carried over by counting words.
    const lastText = row(vs[vs.length - 1], 'translation').text;
    let useText = text, useOff = p.enOff;
    if (norm(lastText) !== norm(text)) {
      useText = lastText;
      useOff = p.enOff.map((o) => {
        const n = (text.slice(0, o).match(/[\p{L}\p{N}]+/gu) || []).length;
        const re = /[\p{L}\p{N}]+/gu;
        let m, i = 0;
        while ((m = re.exec(lastText))) { if (++i === n) { let e = m.index + m[0].length; while (e < lastText.length && !/[\s\p{L}\p{N}]/u.test(lastText[e])) e++; return e; } }
        throw new Error(`${key}: cannot carry the cut over`);
      });
      report.anomalies.push(`en ${key}: verse copies of the translation differ; the last verse's copy is used`);
    }
    const segs = segments(useText, useOff);
    vs.forEach((v, k) => {
      row(v, 'translation').text = segs[k];
      if (k < vs.length - 1) dropRow(v, 'purport');
    });
    report.english.push({ key, verses: ids, segments: segs, purportOn: ids[ids.length - 1], purportChars: purp?.length ?? 0 });
  }
  save(`${SP}/work`, 'en', c, en);
  const newUnits = new Map(unitsFromChapter(en, sa).units.map((u) => [u.verseId, u]));

  // ---------- the seven languages ----------
  for (const lang of LANGS) {
    const file = load(`${SP}/work`, lang, c);
    const byId = new Map(file.verses.map((v) => [v.verseId, v]));
    const orig = load(`${SP}/orig`, lang, c);
    const origById = new Map(orig.verses.map((v) => [v.verseId, v]));
    for (const g of groups) {
      const key = `${c}.${g.verses[0].verseNumber}`;
      const p = plan[key];
      const pl = p.langs[lang];
      const vs = p.verseIds.map((id) => byId.get(id));
      const src = origById.get(pl.from);
      const srcRow = row(src, 'translation');
      if (srcRow.text !== pl.text) throw new Error(`${key}:${lang} plan text is not the source verse's text`);
      const srcAi = src.aiTranslation;
      const S = translationStamp(srcAi);
      const srcScore = S.correctness;
      const srcProv = provenance(S);
      const segs = segments(pl.text, pl.offsets);
      vs.forEach((v, k) => {
        const last = k === vs.length - 1;
        const ai = v.aiTranslation;
        if (!ai) throw new Error(`${v.verseId}:${lang} no aiTranslation`);
        const old = oldUnits.get(v.verseId);
        const nu = newUnits.get(v.verseId);
        if (ai.sourceHash !== sourceHash(old)) anomaly(`${v.verseId}:${lang} old sourceHash does not match the old English unit`);
        const tr = row(v, 'translation');
        if (rowsOf(v, 'translation').length !== 1) anomaly(`${v.verseId}:${lang} ${rowsOf(v, 'translation').length} translation rows`);
        const tgtProv = provenance(ai.parts?.translation ?? ai);
        const viaParts = !!ai.parts || tgtProv !== srcProv;
        if (tgtProv !== srcProv) report.anomalies.push(`${v.verseId}:${lang} translation now comes from ${srcProv} (this verse had ${tgtProv}); the verse moves to per-part stamps`);
        tr.text = segs[k];
        tr.correctness = srcScore;
        tr.translatedBy = translatedByOf(S.provider);
        tr.version = S.version;
        if (!last) dropRow(v, 'purport');

        let note = ai.note;
        if (note && (/translat/i.test(note) || (!last && /purport/i.test(note)))) {
          report.droppedNotes.push({ verseId: v.verseId, lang, note });
          note = undefined;
        }

        if (!viaParts) {
          // legacy shape kept
          ai.partScores = { ...ai.partScores, translation: srcScore };
          if (!last) delete ai.partScores.purport;
          ai.correctness = Math.min(...Object.values(ai.partScores));
          const keepWarn = (ai.warnings || []).filter((w) => !w.startsWith('translation:') && (last || !w.startsWith('purport:')));
          ai.warnings = [...(S.warnings || []), ...keepWarn];
          if (note) ai.note = note; else delete ai.note;
          ai.sourceHash = sourceHash(nu);
          ai.groupSplit = { date: DATE, from: pl.from, part: `${k + 1}/${vs.length}` };
          for (const r of rowsOf(v, 'purport')) r.correctness = ai.partScores.purport;
        } else {
          // per-part stamps: the translation part follows the source verse, the rest stay as they were
          const hadParts = !!ai.parts;
          const parts = ai.parts ? clone(ai.parts) : legacyPartsOf(v, ai);
          parts.translation = { ...clone(S), sourceHash: partHash(nu, 'translation') };
          if (!last) delete parts.purport;
          for (const part of PARTS) {
            if (!parts[part] || part === 'translation') continue;
            const was = parts[part].sourceHash;
            if (was && was !== partHash(old, part)) anomaly(`${v.verseId}:${lang} ${part} stamp hash does not match the old English`);
            parts[part].sourceHash = partHash(nu, part);
          }
          const next = summarise(parts, sourceHash(nu));
          if (!hadParts && note) next.note = [note, ...(next.note ? [next.note] : [])].join(' · ');
          for (const key of Object.keys(ai)) delete ai[key];
          Object.assign(ai, next, { groupSplit: { date: DATE, from: pl.from, part: `${k + 1}/${vs.length}` } });
          for (const r of rowsOf(v, 'purport')) { r.correctness = ai.parts.purport.correctness; r.translatedBy = translatedByOf(ai.parts.purport.provider); r.version = ai.parts.purport.version; }
        }
        mark(lang, c, v.verseId);
      });
      report.langs.push({ key, lang, from: pl.from, score: srcScore, segments: segs });
    }
    save(`${SP}/work`, lang, c, file);
  }
}

fs.writeFileSync(`${SP}/tools/apply-report.json`, JSON.stringify(report, null, 1));
fs.writeFileSync(`${SP}/tools/changed.json`, JSON.stringify(Object.fromEntries(Object.entries(changed).map(([k, s]) => [k, [...s]])), null, 1));
console.log('groups', report.english.length, 'lang splits', report.langs.length, 'anomalies', report.anomalies.length, 'dropped notes', report.droppedNotes.length);
