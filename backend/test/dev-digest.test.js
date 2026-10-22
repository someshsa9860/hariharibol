import test from 'node:test';
import assert from 'node:assert/strict';

import { summary } from '../utils/dev-digest.js';

test('a digest names each kind once with its count', () => {
  const items = [{ type: 'user.signup' }, { type: 'user.signup' }, { type: 'ticket.new' }, { type: 'error.new' }, { type: 'user.signup' }];
  assert.equal(summary(items), '3 new sign-ups, 1 new ticket, 1 new error');
});

test('an unknown kind still counts', () => {
  assert.equal(summary([{ type: 'something.else' }]), '1 event');
});
