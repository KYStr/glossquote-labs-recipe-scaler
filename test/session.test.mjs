import test from 'node:test';
import assert from 'node:assert/strict';
import { RecipeSession } from '../public/js/core/session.mjs';
import { RecipeEditor } from '../public/js/core/editor.mjs';
import { setToTaste } from '../public/js/view.mjs';

function example(language = 'zh-Hant') {
  const session = new RecipeSession({ language });
  const editor = new RecipeEditor(session);
  editor.loadExample(language);
  return { session, editor };
}
function invalidated(session) {
  const snapshot = session.snapshot();
  assert.equal(snapshot.value, null);
  assert.equal(snapshot.report, '');
  assert.equal(snapshot.copyState, 'idle');
  assert.equal(snapshot.copyDisabled, true);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('A17 UI state: To taste synchronously clears the amount; turning it off retains no hidden draft', () => {
  const { session, editor } = example();
  editor.calculate();
  const key = editor.viewRows()[0].key;
  editor.setToTaste(key, true);
  assert.equal(editor.request().rows[0].amount, '');
  invalidated(session);
  const amountInput = { value: '300', disabled: false };
  setToTaste(amountInput, true);
  assert.deepEqual(amountInput, { value: '', disabled: true });
  editor.setField(key, 'amount', 'RESIDUAL_FAKE');
  assert.equal(editor.request().rows[0].amount, '');
  editor.setToTaste(key, false);
  setToTaste(amountInput, false);
  assert.deepEqual(amountInput, { value: '', disabled: false });
  assert.equal(editor.request().rows[0].amount, '');
  assert.deepEqual(editor.calculate(), { ok: false, error: { code: 'ROW_INCOMPLETE', row: 1, field: 'amount' } });
});

test('A31: every raw ingredient edit, add and remove immediately clears output and copy', () => {
  for (const field of ['name', 'amount', 'unit']) {
    const { session, editor } = example();
    editor.calculate();
    const previousRevision = session.snapshot().revision;
    editor.setField(editor.viewRows()[0].key, field, field === 'amount' ? '400' : 'Edited fake');
    assert.ok(session.snapshot().revision > previousRevision);
    invalidated(session);
  }
  const { session, editor } = example();
  editor.calculate();
  const key = editor.add();
  invalidated(session);
  editor.setField(key, 'name', 'Added fake');
  editor.setField(key, 'amount', '1');
  editor.calculate();
  assert.equal(editor.remove(key), true);
  invalidated(session);
});

test('A32: both serving edits and To taste invalidate output; sample loading is manual and idle', () => {
  for (const field of ['originalServings', 'targetServings']) {
    const { session, editor } = example();
    editor.calculate();
    editor.setServing(field, '8');
    invalidated(session);
  }
  const { session, editor } = example();
  invalidated(session);
  editor.calculate();
  editor.setToTaste(editor.viewRows()[2].key, false);
  invalidated(session);
});

test('A33: copy resolve/reject after input change cannot alter a fresh revision', async () => {
  for (const outcome of ['resolve', 'reject']) {
    const { session, editor } = example();
    editor.calculate();
    const pending = deferred();
    const completion = session.copy(() => pending.promise);
    assert.equal(session.snapshot().copyState, 'copying');
    editor.setServing('targetServings', '8');
    invalidated(session);
    editor.calculate();
    const fresh = session.snapshot();
    pending[outcome](outcome === 'reject' ? new Error('FAKE_REJECTION') : undefined);
    assert.equal(await completion, 'stale');
    assert.deepEqual(session.snapshot(), fresh);
  }
});

test('A33: reversed request completion in one revision leaves only the newest copy message', async () => {
  for (const latestOutcome of ['resolve', 'reject']) {
    const { session, editor } = example();
    editor.calculate();
    const old = deferred();
    const latest = deferred();
    const first = session.copy(() => old.promise);
    const second = session.copy(() => latest.promise);
    latest[latestOutcome](latestOutcome === 'reject' ? new Error('FAKE_LATEST') : undefined);
    assert.equal(await second, latestOutcome === 'resolve' ? 'copied' : 'fallback');
    const latestSnapshot = session.snapshot();
    old.reject(new Error('FAKE_OLD'));
    assert.equal(await first, 'stale');
    assert.deepEqual(session.snapshot(), latestSnapshot);
  }
});

test('A34: missing, rejected and synchronously throwing clipboard expose the current text fallback', async () => {
  for (const writer of [undefined, () => Promise.reject(new Error('FAKE_DENIED')), () => { throw new Error('FAKE_UNAVAILABLE'); }]) {
    const { session, editor } = example();
    editor.calculate();
    const expectedReport = session.snapshot().report;
    assert.equal(await session.copy(writer), 'fallback');
    assert.equal(session.snapshot().copyState, 'fallback');
    assert.equal(session.snapshot().report, expectedReport);
    assert.equal(session.snapshot().copyDisabled, false);
    editor.setField(editor.viewRows()[0].key, 'name', 'Edited fake');
    invalidated(session);
  }
});

test('A34: writer is invoked synchronously after busy state is visible and receives exactly the current report', async () => {
  const { session, editor } = example('en');
  editor.calculate();
  const expected = session.snapshot().report;
  let called = false;
  const operation = session.copy(text => {
    assert.equal(session.snapshot().copyState, 'copying');
    assert.equal(session.snapshot().copyDisabled, true);
    assert.equal(text, expected);
    called = true;
    return Promise.resolve();
  });
  assert.equal(called, true);
  assert.equal(await operation, 'copied');
});

test('A35: clear, pagehide, and a fresh editor reset all draft values and output without restoring any state', async () => {
  for (const action of ['clear', 'pagehide']) {
    const { session, editor } = example();
    editor.calculate();
    const pending = deferred();
    const operation = session.copy(() => pending.promise);
    editor[action]();
    assert.deepEqual(editor.request(), { originalServings: '1', targetServings: '1', rows: [{ name: '', amount: '', unit: '', toTaste: false }] });
    invalidated(session);
    pending.resolve();
    assert.equal(await operation, 'stale');
  }
  const session = new RecipeSession();
  const fresh = new RecipeEditor(session);
  assert.deepEqual(fresh.request(), { originalServings: '1', targetServings: '1', rows: [{ name: '', amount: '', unit: '', toTaste: false }] });
  invalidated(session);
});

test('raw editor retains complete oversize input, including pasted quantities; validation never calculates a truncated prefix', () => {
  const { session, editor } = example();
  editor.calculate();
  const key = editor.viewRows()[0].key;
  editor.setField(key, 'amount', '00000000000000001');
  assert.equal(editor.request().rows[0].amount, '00000000000000001');
  invalidated(session);
  assert.deepEqual(editor.calculate(), { ok: false, error: { code: 'AMOUNT_TOO_LONG', row: 1, field: 'amount' } });
  editor.setField(key, 'amount', '300');
  editor.setField(key, 'name', 'a'.repeat(257));
  assert.equal(editor.request().rows[0].name.length, 257);
  assert.deepEqual(editor.calculate(), { ok: false, error: { code: 'NAME_RAW_TOO_LONG', row: 1, field: 'name' } });
});

test('raw multiline drafts are preserved and rejected instead of silently joining digits into a different quantity', () => {
  const { session, editor } = example();
  const key = editor.viewRows()[0].key;
  editor.setField(key, 'amount', '1\n2');
  assert.equal(editor.request().rows[0].amount, '1\n2');
  assert.deepEqual(editor.calculate(), { ok: false, error: { code: 'INVALID_QUANTITY', row: 1, field: 'amount' } });
  invalidated(session);
  editor.setField(key, 'amount', '300');
  editor.setServing('targetServings', '1\n2');
  assert.equal(editor.request().targetServings, '1\n2');
  assert.deepEqual(editor.calculate(), { ok: false, error: { code: 'INVALID_SERVINGS', row: null, field: 'servings-target' } });
});

test('valid calculations own immutable independent snapshots; modifying caller drafts cannot change them', () => {
  const { session, editor } = example();
  const request = editor.request();
  const result = session.calculate(request);
  request.rows[0].amount = '999';
  assert.equal(session.snapshot().value.rows[0].scaledText, '450');
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.rows), true);
  assert.equal(Object.isFrozen(result.value.rows[0]), true);
  assert.throws(() => { result.value.rows[0].scaledText = '999'; }, TypeError);
  const oldValue = result.value;
  const fresh = editor.calculate();
  assert.notEqual(fresh.value, oldValue);
  assert.deepEqual(fresh.value, oldValue);
});

test('editor has one to fifty rows, preserves stable IDs, and never auto-calculates', () => {
  const session = new RecipeSession();
  const editor = new RecipeEditor(session);
  const firstKey = editor.viewRows()[0].key;
  assert.equal(editor.remove(firstKey), false);
  for (let index = 1; index < 50; index += 1) assert.notEqual(editor.add(), null);
  assert.equal(editor.add(), null);
  assert.equal(editor.request().rows.length, 50);
  invalidated(session);
  assert.equal(editor.remove(editor.viewRows()[1].key), true);
  assert.equal(editor.viewRows()[0].key, firstKey);
});
