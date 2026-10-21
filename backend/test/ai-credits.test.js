import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths, creditMeter, localDateKey, nextLocalMidnight, reconcileWallet, repliesIn, spendable, whyBlocked,
} from '../utils/ai-credits.js';

test('the day is the local day, not the UTC day', () => {
  const at = new Date('2026-10-16T19:00:00Z'); // 00:30 on the 17th in India
  assert.equal(localDateKey(at, 'Asia/Kolkata'), '2026-10-17');
  assert.equal(localDateKey(at, 'UTC'), '2026-10-16');
  assert.equal(localDateKey(at, 'America/New_York'), '2026-10-16');
  assert.equal(localDateKey(at, 'Not/AZone'), '2026-10-17', 'a bad zone falls back to Asia/Kolkata');
});

test('midnight is the next local midnight', () => {
  const at = new Date('2026-10-16T19:00:00Z');
  assert.equal(nextLocalMidnight(at, 'Asia/Kolkata').toISOString(), '2026-10-17T18:30:00.000Z');
  assert.equal(nextLocalMidnight(at, 'America/New_York').toISOString(), '2026-10-17T04:00:00.000Z');
  // Across a daylight-saving change (US clocks go back on 2026-11-01).
  assert.equal(nextLocalMidnight(new Date('2026-11-01T12:00:00Z'), 'America/New_York').toISOString(), '2026-11-02T05:00:00.000Z');
});

test('the cap resets exactly at midnight: usage keyed by date stops counting', () => {
  const before = new Date('2026-10-16T18:29:00Z');
  const after = new Date('2026-10-16T18:31:00Z');
  assert.notEqual(localDateKey(before, 'Asia/Kolkata'), localDateKey(after, 'Asia/Kolkata'));
});

test('addMonths clamps to the end of a shorter month', () => {
  assert.equal(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString(), '2026-02-28T00:00:00.000Z');
  assert.equal(addMonths(new Date('2026-12-15T00:00:00Z'), 1).toISOString(), '2027-01-15T00:00:00.000Z');
});

test('the meter shows the tighter of the wallet and today’s cap', () => {
  assert.deepEqual(creditMeter({ balance: 1000, allocation: 1000, dailyUsed: 0, dailyLimit: 100 }).percent, 100);
  const walletTight = creditMeter({ balance: 250, allocation: 1000, dailyUsed: 10, dailyLimit: 100 });
  assert.equal(walletTight.percent, 25);
  assert.equal(walletTight.limitedBy, 'wallet');
  const dailyTight = creditMeter({ balance: 900, allocation: 1000, dailyUsed: 80, dailyLimit: 100 });
  assert.equal(dailyTight.percent, 20);
  assert.equal(dailyTight.limitedBy, 'daily');
});

test('the meter is clamped to 0–100 and knows when nothing is left', () => {
  assert.equal(creditMeter({ balance: 5000, allocation: 1000 }).percent, 100, 'a grant above the allocation reads 100');
  const empty = creditMeter({ balance: -40, allocation: 1000 });
  assert.equal(empty.percent, 0);
  assert.equal(empty.exhausted, true);
  assert.equal(creditMeter({ balance: 500, allocation: 1000, dailyUsed: 100, dailyLimit: 100 }).exhausted, true);
  assert.equal(creditMeter({ balance: 500, allocation: 1000, dailyUsed: 99, dailyLimit: 100 }).exhausted, false);
  assert.equal(creditMeter({ balance: 10, allocation: 0 }).percent, 0, 'no allocation, no division by zero');
});

test('spendable is the smallest of wallet, daily and conversation room; 0 means no limit', () => {
  assert.equal(spendable({ balance: 1000, dailyUsed: 200, dailyLimit: 500, conversationUsed: 0, conversationLimit: 0 }), 300);
  assert.equal(spendable({ balance: 100, dailyUsed: 0, dailyLimit: 0 }), 100);
  assert.equal(spendable({ balance: 1000, dailyUsed: 0, dailyLimit: 0, conversationUsed: 900, conversationLimit: 1000 }), 100);
  assert.equal(spendable({ balance: -5, dailyUsed: 0, dailyLimit: 0 }), 0);
  assert.equal(spendable({ balance: 50, dailyUsed: 600, dailyLimit: 500 }), 0, 'over the cap never goes negative');
});

test('replies are a count rounded down to fives, and nothing for no wallet', () => {
  assert.equal(repliesIn(60_000, 4000), 15);
  assert.equal(repliesIn(800_000, 4000), 200);
  assert.equal(repliesIn(815_000, 4000), 200, 'a figure it cannot stand behind is rounded down');
  assert.equal(repliesIn(39_999, 4000), 9, 'under ten replies it is exact');
  assert.equal(repliesIn(44_000, 4000), 10);
  assert.equal(repliesIn(56_000, 4000), 10, 'fourteen replies is stated as ten');
  assert.equal(repliesIn(4000, 4000), 1);
  assert.equal(repliesIn(3999, 4000), 0);
  assert.equal(repliesIn(0, 4000), 0);
  assert.equal(repliesIn(-5, 4000), 0);
  assert.equal(repliesIn(60_000, 0), 0, 'a bad divisor is not infinity');
});

test('whyBlocked names the limit the reader can act on', () => {
  const base = { balance: 1000, dailyUsed: 0, dailyLimit: 0, conversationUsed: 0, conversationLimit: 0 };
  assert.equal(whyBlocked({ ...base, needed: 100 }), null);
  assert.equal(whyBlocked({ ...base, balance: 50, needed: 100 }), 'WALLET');
  assert.equal(whyBlocked({ ...base, dailyUsed: 450, dailyLimit: 500, needed: 100 }), 'DAILY');
  assert.equal(whyBlocked({ ...base, conversationUsed: 950, conversationLimit: 1000, needed: 100 }), 'CONVERSATION');
});

const allowance = (over = {}) => ({ walletTokens: 1000, renewal: 'MONTHLY', ...over });
const NOW = new Date('2026-10-16T00:00:00Z');

test('a new user gets a full wallet and a ledger credit', () => {
  const d = reconcileWallet({ wallet: null, allowance: allowance(), planId: 'p1', now: NOW });
  assert.equal(d.create.balance, 1000);
  assert.equal(d.create.allocation, 1000);
  assert.equal(d.create.periodEnd.toISOString(), '2026-11-16T00:00:00.000Z');
  assert.equal(d.credit.tokens, 1000);
});

test('a wallet that never renews has no period', () => {
  const d = reconcileWallet({ wallet: null, allowance: allowance({ renewal: 'NEVER' }), planId: 'p1', now: NOW });
  assert.equal(d.create.periodEnd, null);
});

test('nothing happens to a wallet that is up to date', () => {
  const wallet = { planId: 'p1', balance: 400, allocation: 1000, periodEnd: new Date('2026-11-01T00:00:00Z') };
  const d = reconcileWallet({ wallet, allowance: allowance(), planId: 'p1', now: NOW });
  assert.equal(d.update, null);
  assert.equal(d.credit, null);
});

test('an upgrade credits the difference; a downgrade leaves the balance alone', () => {
  const wallet = { planId: 'p1', balance: 300, allocation: 1000, periodEnd: new Date('2026-11-01T00:00:00Z') };
  const up = reconcileWallet({ wallet, allowance: allowance({ walletTokens: 5000 }), planId: 'p2', now: NOW });
  assert.equal(up.credit.tokens, 4000);
  assert.equal(up.update.allocation, 5000);
  assert.equal(up.update.planId, 'p2');

  const down = reconcileWallet({ wallet, allowance: allowance({ walletTokens: 600 }), planId: 'p0', now: NOW });
  assert.equal(down.credit, null);
  assert.equal(down.update.allocation, 600);
});

test('renewal tops the wallet up to the allocation, never beyond', () => {
  const ended = new Date('2026-10-15T00:00:00Z');
  const low = reconcileWallet({ wallet: { planId: 'p1', balance: 120, allocation: 1000, periodEnd: ended }, allowance: allowance(), planId: 'p1', now: NOW });
  assert.equal(low.credit.tokens, 880);
  assert.equal(low.update.periodEnd.toISOString(), '2026-11-16T00:00:00.000Z');

  const overdrawn = reconcileWallet({ wallet: { planId: 'p1', balance: -30, allocation: 1000, periodEnd: ended }, allowance: allowance(), planId: 'p1', now: NOW });
  assert.equal(overdrawn.credit.tokens, 1000, 'an overdraft is forgiven, not carried');

  const granted = reconcileWallet({ wallet: { planId: 'p1', balance: 4000, allocation: 1000, periodEnd: ended }, allowance: allowance(), planId: 'p1', now: NOW });
  assert.equal(granted.credit, null, 'an admin grant above the allocation is not topped up or taken back');
  assert.ok(granted.update.periodEnd, 'but the period still rolls over');
});

test('a free-tier bonus is spent beside the wallet and outside the daily cap', () => {
  // Wallet 500, cap 100 with 100 used: nothing left from the wallet's side, but 40 of bonus is.
  assert.equal(spendable({ balance: 500, dailyUsed: 100, dailyLimit: 100, bonusLeft: 40 }), 40);
  assert.equal(spendable({ balance: 500, dailyUsed: 60, dailyLimit: 100, bonusLeft: 40 }), 80);
  assert.equal(spendable({ balance: 0, dailyUsed: 0, dailyLimit: 100, bonusLeft: 40 }), 40, 'an empty wallet still has the bonus');
  assert.equal(spendable({ balance: 500, dailyLimit: 100, conversationUsed: 90, conversationLimit: 100, bonusLeft: 40 }), 10, 'a chat share still bounds it');
  assert.equal(spendable({ balance: 500, dailyLimit: 100, bonusLeft: 0 }), 100, 'no bonus changes nothing');
});

test('whyBlocked counts the bonus before it blames the daily cap or the wallet', () => {
  assert.equal(whyBlocked({ balance: 500, dailyUsed: 100, dailyLimit: 100, needed: 30, bonusLeft: 40 }), null);
  assert.equal(whyBlocked({ balance: 500, dailyUsed: 100, dailyLimit: 100, needed: 50, bonusLeft: 40 }), 'DAILY');
  assert.equal(whyBlocked({ balance: 0, dailyLimit: 0, needed: 50, bonusLeft: 40 }), 'WALLET');
});

test('the meter treats the bonus as more of both limits', () => {
  const none = creditMeter({ balance: 0, allocation: 1000, dailyUsed: 100, dailyLimit: 100 });
  assert.equal(none.exhausted, true);
  const withBonus = creditMeter({ balance: 0, allocation: 1000, dailyUsed: 100, dailyLimit: 100, bonusTotal: 100, bonusUsed: 0 });
  assert.equal(withBonus.exhausted, false);
  assert.ok(withBonus.percent > 0);
  const spentBonus = creditMeter({ balance: 0, allocation: 1000, dailyUsed: 100, dailyLimit: 100, bonusTotal: 100, bonusUsed: 100 });
  assert.equal(spentBonus.exhausted, true);
  assert.equal(spentBonus.percent, 0);
  // Untouched: a full wallet and a full bonus still read 100.
  assert.equal(creditMeter({ balance: 1000, allocation: 1000, dailyLimit: 100, bonusTotal: 50 }).percent, 100);
});
