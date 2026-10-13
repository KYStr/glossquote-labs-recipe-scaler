import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scaleRecipe } from '../public/js/core/recipe.mjs';
import { recipeReport } from '../public/js/core/report.mjs';
import { renderResultRows } from '../public/js/view.mjs';

const fixtures = JSON.parse(await readFile(new URL('./fixtures/oracles.json', import.meta.url), 'utf8'));
const row = (overrides = {}) => ({ name: 'Fixture', amount: '1', unit: 'g', toTaste: false, ...overrides });
const request = (overrides = {}) => ({ originalServings: '1', targetServings: '1', rows: [row()], ...overrides });
function error(input, code, index = null, field = null) {
  assert.deepEqual(scaleRecipe(input), { ok: false, error: { code, row: index, field } });
}
function scaled(amount, overrides = {}) { return scaleRecipe(request({ rows: [row({ amount })], ...overrides })); }

for (const fixture of fixtures.cases) {
  test(`${fixture.case}: fixed exact/half-up oracle ${fixture.original} to ${fixture.target}, ${fixture.amount}`, () => {
    const result = scaleRecipe(request({ originalServings: fixture.original, targetServings: fixture.target,
      rows: [row({ amount: fixture.amount, unit: fixture.unit })] }));
    assert.deepEqual(result, { ok: true, value: {
      originalServings: Number(fixture.original), targetServings: Number(fixture.target),
      rows: [{ name: 'Fixture', originalText: fixture.amount, scaledText: fixture.expected,
        unit: fixture.unit, toTaste: false, approximate: fixture.approximate }],
      summary: { rowCount: 1, scaledCount: 1, toTasteCount: 0 }
    } });
  });
}

test('A3: to taste remains fixed text, unit is retained, summary counts it', () => {
  const result = scaleRecipe(request({ originalServings: '4', targetServings: '6', rows: [row({ name: '鹽', amount: '', unit: '原標籤', toTaste: true })] }));
  assert.deepEqual(result.value.rows, [{ name: '鹽', originalText: '適量', scaledText: '適量', unit: '原標籤', toTaste: true, approximate: false }]);
  assert.deepEqual(result.value.summary, { rowCount: 1, scaledCount: 0, toTasteCount: 1 });
});

test('A6: one to one preserves numerical value and exactness; original input spelling is retained', () => {
  for (const [amount, expected] of [['0', '0'], ['000.500', '0.5'], ['1.200', '1.2'], ['1000000.000', '1000000'], ['1.234', '1.234']]) {
    const result = scaled(amount);
    assert.equal(result.ok, true);
    assert.equal(result.value.rows[0].originalText, amount);
    assert.equal(result.value.rows[0].scaledText, expected);
    assert.equal(result.value.rows[0].approximate, false);
  }
});
test('A11: value above the input ceiling is rejected', () => error(request({ rows: [row({ amount: '1000000.001' })] }), 'QUANTITY_TOO_LARGE', 1, 'amount'));
test('A12: inclusive million boundary with three decimals', () => {
  assert.equal(scaled('1000000.000').value.rows[0].scaledText, '1000000');
  error(request({ rows: [row({ amount: '1000000.001' })] }), 'QUANTITY_TOO_LARGE', 1, 'amount');
});
test('A13: strict ASCII grammar rejects fractions, signs, grouping, exponent, whitespace and Unicode digits', () => {
  for (const amount of ['.5', '1.', '+1', '-1', '1,000', '1e3', '١', '１', '1/2', ' 1', '1 ', '1\n', '.', 'NaN', 'Infinity']) {
    error(request({ rows: [row({ amount })] }), 'INVALID_QUANTITY', 1, 'amount');
  }
});
test('A14: zero, leading zeros and decimal trailing zeros are accepted and formatted', () => {
  for (const [amount, expected] of [['0', '0'], ['000.500', '0.5'], ['1.200', '1.2']]) assert.equal(scaled(amount).value.rows[0].scaledText, expected);
});
test('A15: three decimals accepted, four rejected without rounding the input', () => {
  assert.equal(scaled('1.234').value.rows[0].scaledText, '1.234');
  error(request({ rows: [row({ amount: '1.2345' })] }), 'INVALID_QUANTITY', 1, 'amount');
  error(request({ originalServings: '2', targetServings: '3', rows: [row({ amount: '0.0015' })] }), 'INVALID_QUANTITY', 1, 'amount');
});
test('A16: blank scalable amount is incomplete', () => error(request({ rows: [row({ amount: '' })] }), 'ROW_INCOMPLETE', 1, 'amount'));
test('A17: to-taste amount must be exactly empty, including spaces and zero', () => {
  for (const amount of ['0', ' ', '1']) error(request({ rows: [row({ amount, toTaste: true })] }), 'TO_TASTE_AMOUNT_NOT_EMPTY', 1, 'amount');
});
test('A18: trimmed blank name is not skipped', () => error(request({ rows: [row({ name: ' \t\n ' }), row()] }), 'ROW_INCOMPLETE', 1, 'name'));
test('A19: raw name cap precedes trim; UTF-16 normalized cap is inclusive', () => {
  assert.equal(scaleRecipe(request({ rows: [row({ name: 'a'.repeat(80) + ' '.repeat(176) })] })).ok, true);
  error(request({ rows: [row({ name: 'a' + ' '.repeat(256) })] }), 'NAME_RAW_TOO_LONG', 1, 'name');
  assert.equal(scaleRecipe(request({ rows: [row({ name: '🙂'.repeat(40) })] })).ok, true);
  error(request({ rows: [row({ name: 'a'.repeat(81) })] }), 'NAME_TOO_LONG', 1, 'name');
});
test('A20: raw unit cap precedes trim; unit cap and casing are preserved', () => {
  const result = scaleRecipe(request({ rows: [row({ unit: 'G'.repeat(24) + ' '.repeat(104) })] }));
  assert.equal(result.value.rows[0].unit, 'G'.repeat(24));
  error(request({ rows: [row({ unit: 'g' + ' '.repeat(128) })] }), 'UNIT_RAW_TOO_LONG', 1, 'unit');
  error(request({ rows: [row({ unit: 'g'.repeat(25) })] }), 'UNIT_TOO_LONG', 1, 'unit');
});
test('A21: amount raw cap and string type apply even to to-taste rows', () => {
  error(request({ rows: [row({ amount: ' '.repeat(16), toTaste: true })] }), 'TO_TASTE_AMOUNT_NOT_EMPTY', 1, 'amount');
  error(request({ rows: [row({ amount: ' '.repeat(17), toTaste: true })] }), 'AMOUNT_TOO_LONG', 1, 'amount');
  error(request({ rows: [row({ amount: 1, toTaste: true })] }), 'INVALID_REQUEST');
  assert.equal(scaled('0000000000000001').value.rows[0].scaledText, '1');
});
test('A22: trimmed name and unit reject embedded C0/C1 controls', () => {
  for (const character of ['\u0000', '\u0009', '\u001f', '\u007f', '\u0085', '\u009f']) {
    error(request({ rows: [row({ name: `a${character}b` })] }), 'CONTROL_CHARACTER', 1, 'name');
    error(request({ rows: [row({ unit: `g${character}m` })] }), 'CONTROL_CHARACTER', 1, 'unit');
  }
});
test('A23: servings inclusive limits and invalid values, with correct first field', () => {
  assert.equal(scaled('1', { originalServings: '1', targetServings: '1000' }).ok, true);
  assert.equal(scaled('1', { originalServings: '1000', targetServings: '1' }).ok, true);
  for (const servings of ['0', '1001', '', '-1', '2.0', ' 1', '１']) {
    error(request({ originalServings: servings }), 'INVALID_SERVINGS', null, 'servings-original');
    error(request({ targetServings: servings }), 'INVALID_SERVINGS', null, 'servings-target');
  }
});
test('A24: four ASCII digits allow leading zeros; five fail', () => {
  assert.equal(scaled('1', { originalServings: '0001', targetServings: '0001' }).value.originalServings, 1);
  error(request({ originalServings: '00001' }), 'INVALID_SERVINGS', null, 'servings-original');
});
test('A25: row-count boundaries, including a complete fifty-first row', () => {
  assert.equal(scaleRecipe(request()).ok, true);
  error(request({ rows: [] }), 'TOO_FEW_ROWS', null, 'rows');
  error(request({ rows: Array.from({ length: 51 }, () => row()) }), 'TOO_MANY_ROWS', null, 'rows');
});
test('A26: second incomplete row gives a first error and no partial value', () => error(request({ rows: [row(), row({ amount: '' }), row()] }), 'ROW_INCOMPLETE', 2, 'amount'));

test('A27: exact envelope and row data-property schemas fail closed without invoking accessors', () => {
  let accessorCalls = 0;
  const missing = request(); delete missing.targetServings;
  const symbol = request(); symbol[Symbol('extra')] = 'fake';
  const hidden = request(); Object.defineProperty(hidden, 'extra', { value: true });
  const getter = request(); Object.defineProperty(getter, 'originalServings', { enumerable: true, get() { accessorCalls += 1; return '1'; } });
  const nonEnumerable = request(); Object.defineProperty(nonEnumerable, 'originalServings', { value: '1', enumerable: false });
  const badEnvelope = [null, [], new Date(0), new (class Request {})(), missing, symbol, hidden, getter, nonEnumerable,
    request({ extra: true }), request({ originalServings: 1 }), request({ targetServings: null }), request({ rows: {} })];
  for (const input of badEnvelope) error(input, 'INVALID_REQUEST');
  const rowMissing = row(); delete rowMissing.unit;
  const rowSymbol = row(); rowSymbol[Symbol('extra')] = true;
  const rowHidden = row(); Object.defineProperty(rowHidden, 'extra', { value: 'fake' });
  const rowAccessor = row(); Object.defineProperty(rowAccessor, 'amount', { enumerable: true, get() { accessorCalls += 1; return '1'; } });
  const rowSetter = row(); Object.defineProperty(rowSetter, 'unit', { enumerable: true, set() { accessorCalls += 1; } });
  const rowNonEnumerable = row(); Object.defineProperty(rowNonEnumerable, 'name', { value: 'fake', enumerable: false });
  for (const badRow of [null, [], new Date(0), new (class Row {})(), rowMissing, rowSymbol, rowHidden, rowAccessor, rowSetter, rowNonEnumerable,
    row({ extra: true }), row({ name: 1 }), row({ amount: 1 }), row({ unit: false }), row({ toTaste: 'false' })]) {
    error(request({ rows: [badRow] }), 'INVALID_REQUEST');
  }
  assert.equal(accessorCalls, 0);
  const nullRow = Object.assign(Object.create(null), row());
  const nullRequest = Object.assign(Object.create(null), request({ rows: [nullRow] }));
  assert.equal(scaleRecipe(nullRequest).ok, true);
  const revoked = Proxy.revocable(request(), {}); revoked.revoke();
  error(revoked.proxy, 'INVALID_REQUEST');
});
test('A28: dense array schema rejects holes, subclasses, prototypes, symbols, custom keys and accessor indices', () => {
  const sparse = [row(), , row()];
  const custom = [row()]; Object.setPrototypeOf(custom, null);
  const subclass = new (class Rows extends Array {})(); subclass.push(row());
  const symbol = [row()]; symbol[Symbol('extra')] = true;
  const extra = [row()]; extra.extra = true;
  const hidden = [row()]; Object.defineProperty(hidden, 'extra', { value: true });
  const nonEnumerable = [row()]; Object.defineProperty(nonEnumerable, '0', { value: row(), enumerable: false });
  let getterCalls = 0;
  const getter = [row()]; Object.defineProperty(getter, '0', { enumerable: true, get() { getterCalls += 1; return row(); } });
  for (const rows of [sparse, custom, subclass, symbol, extra, hidden, nonEnumerable, getter]) error(request({ rows }), 'INVALID_REQUEST');
  assert.equal(getterCalls, 0);
});
test('A29: fifty complete rows preserve order, strict result shape and counts', () => {
  const result = scaleRecipe(request({ targetServings: '2', rows: Array.from({ length: 50 }, (_, index) => row({ name: `Fixture ${index + 1}`, amount: String(index) })) }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.summary, { rowCount: 50, scaledCount: 50, toTasteCount: 0 });
  assert.deepEqual(result.value.rows.map(item => item.name), Array.from({ length: 50 }, (_, index) => `Fixture ${index + 1}`));
  assert.deepEqual(Object.keys(result.value.rows[0]), ['name', 'originalText', 'scaledText', 'unit', 'toTaste', 'approximate']);
  assert.equal(result.value.rows[49].scaledText, '98');
});
test('A30: literal LF reports preserve name, quantity, unit and order in both languages', () => {
  const result = scaleRecipe(request({ originalServings: '4', targetServings: '6', rows: [
    row({ name: '米', amount: '300' }), row({ name: '水', amount: '1.2', unit: 'L' }), row({ name: '鹽', amount: '', unit: '', toTaste: true })
  ] }));
  assert.equal(recipeReport(result.value), '食譜份量換算\n份數: 4 → 6\n食材名稱\t原量\t換算後\t單位\t精度\n米\t300\t450\tg\t準確\n水\t1.2\t1.8\tL\t準確\n鹽\t適量\t適量\t\t不縮放\n\n最多 3 位小數；採 half-up 四捨五入。近似值已標示；單位不換算。');
  assert.equal(recipeReport(result.value, 'en'), 'Recipe scaler\nServings: 4 → 6\nIngredient name\tOriginal\tScaled\tUnit\tPrecision\n米\t300\t450\tg\tExact\n水\t1.2\t1.8\tL\tExact\n鹽\tTo taste\tTo taste\t\tUnchanged\n\nUp to 3 decimal places; half-up rounding. Approximate values are marked; units are not converted.');
  assert.doesNotMatch(recipeReport(result.value), /\r|<table|<tr|<td/);
  assert.match(recipeReport(scaled('0.001', { originalServings: '3' }).value, 'en'), /< 0\.001/);
});

test('A36: renderer uses literal textContent for hostile names and unit labels (unit DOM sink test)', () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const result = scaleRecipe(request({ rows: [row({ name: malicious, unit: '<script>' })] }));
  const nodes = [];
  const document = { createElement(tag) {
    const node = { tag, children: [], textContent: '', append(...children) { this.children.push(...children); }, setAttribute() {} };
    Object.defineProperty(node, 'innerHTML', { set() { throw new Error('UNSAFE_HTML_SINK'); } });
    nodes.push(node); return node;
  } };
  const tbody = { replaceChildren(...rows) { this.rows = rows; } };
  renderResultRows(document, tbody, result.value, 'zh-Hant');
  assert.equal(tbody.rows.length, 1);
  assert.equal(nodes.find(node => node.tag === 'th').textContent, malicious);
  assert.ok(nodes.some(node => node.textContent === '<script>'));
  assert.equal(nodes.filter(node => node.tag === 'img' || node.tag === 'script').length, 0);
});
test('A37: large boundary half-up stays byte-identical across repeated calls', () => {
  const input = request({ originalServings: '3', targetServings: '1000', rows: [row({ amount: '1000000' })] });
  const expected = { ok: true, value: { originalServings: 3, targetServings: 1000,
    rows: [{ name: 'Fixture', originalText: '1000000', scaledText: '333333333.333', unit: 'g', toTaste: false, approximate: true }],
    summary: { rowCount: 1, scaledCount: 1, toTasteCount: 0 } } };
  for (let repeat = 0; repeat < 100; repeat += 1) assert.equal(JSON.stringify(scaleRecipe(input)), JSON.stringify(expected));
});
test('A38: independent integer tie check yields one milli-unit and approximate=true', () => {
  const exactNumerator = 1n;
  const exactDenominator = 2n;
  assert.equal(exactNumerator * 2n, exactDenominator); // Exactly half one milli-unit, no Number arithmetic.
  const integerPart = exactNumerator / exactDenominator;
  const remainder = exactNumerator % exactDenominator;
  const independentExpectedRoundedMilliUnits = integerPart + (remainder * 2n >= exactDenominator ? 1n : 0n);
  assert.equal(independentExpectedRoundedMilliUnits, 1n);
  const result = scaled('0.001', { originalServings: '2' });
  assert.equal(result.value.rows[0].scaledText, '0.001');
  assert.equal(result.value.rows[0].approximate, true);
});
test('validation order: full schema, servings, count, then raw lengths/trim/quantity; errors never echo content', () => {
  error(request({ originalServings: '0', rows: [row({ extra: 'FAKE_CANARY' })] }), 'INVALID_REQUEST');
  error(request({ originalServings: '0', targetServings: '0', rows: [] }), 'INVALID_SERVINGS', null, 'servings-original');
  error(request({ targetServings: '0', rows: [] }), 'INVALID_SERVINGS', null, 'servings-target');
  error(request({ rows: [row({ name: 'a'.repeat(257), unit: 'g'.repeat(129), amount: '1'.repeat(17) })] }), 'NAME_RAW_TOO_LONG', 1, 'name');
  error(request({ rows: [row({ name: '', unit: 'g'.repeat(129), amount: '1'.repeat(17) })] }), 'UNIT_RAW_TOO_LONG', 1, 'unit');
  error(request({ rows: [row({ name: '', amount: '1'.repeat(17) })] }), 'AMOUNT_TOO_LONG', 1, 'amount');
  error(request({ rows: [row({ name: '', amount: 'bad' })] }), 'ROW_INCOMPLETE', 1, 'name');
  assert.doesNotMatch(JSON.stringify(scaleRecipe(request({ rows: [row({ amount: 'FAKE_CANARY' })] }))), /FAKE_CANARY/);
});
