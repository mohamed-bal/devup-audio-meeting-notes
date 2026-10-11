import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTranscript, validateNotes, makeReviewPacket } from './core.mjs';

const blocks = normalizeTranscript({ text: 'Meriem will review the mobile page before Thursday.' });
const item = {
  kind: 'action', statement: 'Review the mobile page.',
  owner: 'Meriem', dueText: 'before Thursday',
  evidence: [{ segmentId: 'S0001', quote: blocks[0].text }],
};

test('text-only evidence does not acquire timestamps', () => {
  assert.equal(validateNotes({ items: [item] }, blocks)[0].evidence[0].start, null);
});

test('an invented calendar date fails the literal-evidence check', () => {
  const invented = { ...item, dueText: '2030-01-01' };
  assert.throws(() => validateNotes({ items: [invented] }, blocks), /UNSUPPORTED_ACTION_FIELD/);
});

test('a wrong statement can pass quote checks; it still requires review', () => {
  const wrong = { ...item, statement: 'Cancel the entire product launch.' };
  const packet = makeReviewPacket(blocks, { items: [wrong] });
  assert.equal(packet.items[0].statement, wrong.statement);
  assert.equal(packet.status, 'draft');
  assert.equal(packet.requiresHumanReview, true);
});
