// Turns an IP address into a place — country, state, district, city — using MaxMind's GeoLite2 City database, an
// .mmdb file on disk (`GEOIP_DB_PATH`). Nothing leaves the machine: the lookup is a few microseconds in memory, so
// no reader's address is sent to a third party and there is no per-request cost or rate limit.
//
// It is optional on purpose. With no path set, or a file that is not there, `locate()` answers null and the rest of
// the API carries on; the columns on `User` just stay empty until the file is installed (secrets/README.md).
//
// What the database can and cannot say: a country is nearly always right, a state usually, a city often, and a
// district only where MaxMind's second subdivision is filled in — which is rare, and in India often missing. A VPN,
// a company network or a mobile carrier's gateway shows the place of that network, not of the phone.

import { existsSync } from 'node:fs';
import maxmind from 'maxmind';

import env from '../config/env.js';
import logger from '../config/logger.js';

let opened = null; // a promise of the reader, or of null when there is none; opened once

function open() {
  if (opened) return opened;

  opened = (async () => {
    const path = env.geoIpDbPath;
    if (!path) return null;

    if (!existsSync(path)) {
      logger.warn({ path }, 'GEOIP_DB_PATH points at nothing — user locations stay empty');
      return null;
    }

    try {
      const reader = await maxmind.open(path);
      logger.info({ path }, 'geo-ip database loaded');
      return reader;
    } catch (err) {
      logger.warn({ err: err.message, path }, 'geo-ip database could not be opened — user locations stay empty');
      return null;
    }
  })();

  return opened;
}

// Express hands an IPv4 caller on a dual-stack socket over as `::ffff:203.0.113.9`.
export function cleanIp(ip) {
  const value = String(ip || '').trim();
  return value.toLowerCase().startsWith('::ffff:') ? value.slice(7) : value;
}

const clip = (value, max) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : null;
};

/**
 * Pure: the columns of `User` from one GeoLite2 City record, or null when it names no country.
 * State is the first subdivision, district the second (England → West Berkshire, Maharashtra → a district, where
 * MaxMind has one).
 */
export function placeFromRecord(record) {
  const countryCode = clip(record?.country?.iso_code, 2)?.toUpperCase() || null;
  if (!countryCode) return null;

  const [first, second] = record.subdivisions || [];
  return {
    countryCode,
    country: clip(record.country?.names?.en, 100),
    state: clip(first?.names?.en, 100),
    district: clip(second?.names?.en, 100),
    city: clip(record.city?.names?.en, 100),
  };
}

/**
 * The place an IP address is in — `{ countryCode, country, state, district, city }` — or null when the database is
 * not installed, the address is private, malformed or not in it. Never throws.
 */
export async function locate(ip) {
  const address = cleanIp(ip);
  if (!address) return null;

  const reader = await open();
  if (!reader) return null;

  try {
    return placeFromRecord(reader.get(address));
  } catch {
    // maxmind throws on a string that is not an address.
    return null;
  }
}

// For tests: forget the opened reader so a changed path is read again.
export function reset() {
  opened = null;
}
