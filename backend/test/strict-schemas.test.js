// Every JSON Schema the app sends to a model's structured-output mode. OpenAI's `strict: true` (and Claude's) answers
// 400 to a schema that breaks these rules, and only when a run reaches the provider, so they are checked here.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { answerSchema } from '../scripts/lib/claude-translate-prompt.js';
import { TRANSLATE_SCHEMA as CALENDAR } from '../utils/calendar-translation.js';
import { TRANSLATE_SCHEMA as ETIQUETTE } from '../utils/etiquette.js';
import { HEADER_SCHEMA as PRAYER_HEADER, VERSES_SCHEMA as PRAYER_VERSES } from '../utils/prayer.js';
import { SCENES_SCHEMA } from '../utils/scenes.js';

const REFUSED_KEYWORDS = ['uniqueItems'];

/** Every way `schema` breaks the strict-mode rules, as "path: what". */
function problems(schema, path = 'schema') {
  const found = [];
  if (Array.isArray(schema)) return schema.flatMap((s, i) => problems(s, `${path}[${i}]`));
  if (!schema || typeof schema !== 'object') return found;

  for (const key of REFUSED_KEYWORDS) if (key in schema) found.push(`${path}: "${key}" is not permitted`);
  if (schema.type === 'object') {
    if (schema.additionalProperties !== false) found.push(`${path}: additionalProperties must be false`);
    const names = Object.keys(schema.properties ?? {});
    const missing = names.filter((n) => !(schema.required ?? []).includes(n));
    if (missing.length) found.push(`${path}: ${missing.join(', ')} must be in required`);
  }
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'properties') for (const [name, child] of Object.entries(value)) found.push(...problems(child, `${path}.${name}`));
    else if (value && typeof value === 'object') found.push(...problems(value, `${path}.${key}`));
  }
  return found;
}

describe('structured-output schemas follow strict mode', () => {
  const schemas = {
    'book translation (all parts)': answerSchema(['hi', 'ta']),
    'book translation (Marathi Bhagavatam, with vikara tags)': answerSchema(['mr', 'hi'], undefined, 'srimad-bhagavatam'),
    'calendar translation': CALENDAR,
    'etiquette translation': ETIQUETTE,
    'prayer heading': PRAYER_HEADER,
    'prayer verses': PRAYER_VERSES,
    'scene storyboard': SCENES_SCHEMA,
  };
  for (const [name, schema] of Object.entries(schemas)) {
    it(name, () => assert.deepEqual(problems(schema), []));
  }
});
