import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanIp, locate, placeFromRecord } from '../services/geo-ip.js';

// The shape maxmind's reader hands back for GeoLite2-City, cut down to what the service reads.
const record = (overrides = {}) => ({
  country: { iso_code: 'IN', names: { en: 'India', de: 'Indien' } },
  subdivisions: [{ iso_code: 'MH', names: { en: 'Maharashtra' } }, { names: { en: 'Pune District' } }],
  city: { names: { en: 'Pune' } },
  ...overrides,
});

test('placeFromRecord reads country, state, district and city in English', () => {
  assert.deepEqual(placeFromRecord(record()), {
    countryCode: 'IN',
    country: 'India',
    state: 'Maharashtra',
    district: 'Pune District',
    city: 'Pune',
  });
});

test('placeFromRecord leaves out what the record does not have', () => {
  assert.deepEqual(placeFromRecord(record({ subdivisions: [{ names: { en: 'England' } }], city: undefined })), {
    countryCode: 'IN',
    country: 'India',
    state: 'England',
    district: null,
    city: null,
  });
  assert.deepEqual(placeFromRecord({ country: { iso_code: 'SG', names: { en: 'Singapore' } } }), {
    countryCode: 'SG',
    country: 'Singapore',
    state: null,
    district: null,
    city: null,
  });
});

test('placeFromRecord upper-cases the code and trims names', () => {
  const place = placeFromRecord(record({ country: { iso_code: 'in', names: { en: '  India ' } } }));
  assert.equal(place.countryCode, 'IN');
  assert.equal(place.country, 'India');
});

test('placeFromRecord answers null when no country is named', () => {
  assert.equal(placeFromRecord(null), null);
  assert.equal(placeFromRecord(undefined), null);
  assert.equal(placeFromRecord({}), null);
  assert.equal(placeFromRecord({ country: { names: { en: 'India' } } }), null); // a name without a code is not a place
  assert.equal(placeFromRecord({ registered_country: { iso_code: 'IN' } }), null); // only where the network is registered
});

test('placeFromRecord clips to the column widths', () => {
  const long = 'x'.repeat(300);
  const place = placeFromRecord(record({ city: { names: { en: long } }, subdivisions: [{ names: { en: long } }] }));
  assert.equal(place.city.length, 100);
  assert.equal(place.state.length, 100);
});

test('cleanIp strips the IPv4-mapped prefix a dual-stack socket adds', () => {
  assert.equal(cleanIp('::ffff:203.0.113.9'), '203.0.113.9');
  assert.equal(cleanIp('::FFFF:203.0.113.9'), '203.0.113.9');
  assert.equal(cleanIp('203.0.113.9'), '203.0.113.9');
  assert.equal(cleanIp('2001:db8::1'), '2001:db8::1');
  assert.equal(cleanIp('  203.0.113.9 '), '203.0.113.9');
  assert.equal(cleanIp(undefined), '');
  assert.equal(cleanIp(null), '');
});

test('locate answers null, and does not throw, with no database installed or no usable address', async () => {
  // GEOIP_DB_PATH is blank in the test environment, so the feature is off.
  assert.equal(await locate('8.8.8.8'), null);
  assert.equal(await locate(''), null);
  assert.equal(await locate(undefined), null);
  assert.equal(await locate('not an address'), null);
});
