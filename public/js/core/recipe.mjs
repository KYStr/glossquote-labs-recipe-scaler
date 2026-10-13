const requestKeys = ['originalServings', 'targetServings', 'rows'];
const rowKeys = ['name', 'amount', 'unit', 'toTaste'];
const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/u;

function failure(code, row = null, field = null) {
  return { ok: false, error: { code, row, field } };
}

// Inspect descriptors, never read an untrusted getter.
function exactDataObject(value, keys) {
  if (value === null || typeof value !== 'object') return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key => !keys.includes(key))) return null;
  const snapshot = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, 'value')) return null;
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function validSchema(request) {
  const snapshot = exactDataObject(request, requestKeys);
  if (!snapshot) return null;
  if (typeof snapshot.originalServings !== 'string' || typeof snapshot.targetServings !== 'string') return null;
  const rows = snapshot.rows;
  if (!Array.isArray(rows) || Object.getPrototypeOf(rows) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(rows, 'length').value;
  const keys = Reflect.ownKeys(rows);
  if (keys.length !== length + 1 || !keys.includes('length')) return null;
  const rowSnapshots = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(rows, String(index));
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, 'value')) return null;
    const row = exactDataObject(descriptor.value, rowKeys);
    if (!row) return null;
    if (typeof row.name !== 'string' || typeof row.amount !== 'string' ||
        typeof row.unit !== 'string' || typeof row.toTaste !== 'boolean') return null;
    rowSnapshots.push(row);
  }
  snapshot.rows = rowSnapshots;
  return snapshot;
}

function parseServings(text) {
  if (!/^[0-9]{1,4}$/.test(text)) return null;
  const value = BigInt(text);
  return value >= 1n && value <= 1000n ? value : null;
}

function parseMilliUnits(text) {
  const [integer, fraction = ''] = text.split('.');
  return BigInt(integer) * 1000n + BigInt(fraction.padEnd(3, '0'));
}

function formatMilliUnits(value) {
  const integer = value / 1000n;
  const fraction = value % 1000n;
  return fraction === 0n ? String(integer) : `${integer}.${String(fraction).padStart(3, '0').replace(/0+$/, '')}`;
}

export function scaleRecipe(request) {
  // A revoked proxy or descriptor trap also fails closed, with no raw error.
  try {
    const snapshot = validSchema(request);
    if (!snapshot) return failure('INVALID_REQUEST');
    const original = parseServings(snapshot.originalServings);
    if (original === null) return failure('INVALID_SERVINGS', null, 'servings-original');
    const target = parseServings(snapshot.targetServings);
    if (target === null) return failure('INVALID_SERVINGS', null, 'servings-target');
    if (snapshot.rows.length === 0) return failure('TOO_FEW_ROWS', null, 'rows');
    if (snapshot.rows.length > 50) return failure('TOO_MANY_ROWS', null, 'rows');

    const output = [];
    let toTasteCount = 0;
    for (let index = 0; index < snapshot.rows.length; index += 1) {
      const input = snapshot.rows[index];
      const row = index + 1;
      if (input.name.length > 256) return failure('NAME_RAW_TOO_LONG', row, 'name');
      if (input.unit.length > 128) return failure('UNIT_RAW_TOO_LONG', row, 'unit');
      if (input.amount.length > 16) return failure('AMOUNT_TOO_LONG', row, 'amount');
      const name = input.name.trim();
      const unit = input.unit.trim();
      if (name.length === 0) return failure('ROW_INCOMPLETE', row, 'name');
      if (controlCharacters.test(name)) return failure('CONTROL_CHARACTER', row, 'name');
      if (controlCharacters.test(unit)) return failure('CONTROL_CHARACTER', row, 'unit');
      if (name.length > 80) return failure('NAME_TOO_LONG', row, 'name');
      if (unit.length > 24) return failure('UNIT_TOO_LONG', row, 'unit');
      if (input.toTaste) {
        if (input.amount !== '') return failure('TO_TASTE_AMOUNT_NOT_EMPTY', row, 'amount');
        toTasteCount += 1;
        output.push({ name, originalText: '適量', scaledText: '適量', unit, toTaste: true, approximate: false });
        continue;
      }
      if (input.amount === '') return failure('ROW_INCOMPLETE', row, 'amount');
      if (!/^[0-9]+(?:\.[0-9]{1,3})?$/.test(input.amount)) return failure('INVALID_QUANTITY', row, 'amount');
      const milliUnits = parseMilliUnits(input.amount);
      if (milliUnits > 1000000000n) return failure('QUANTITY_TOO_LARGE', row, 'amount');
      const numerator = milliUnits * target;
      const rounded = (2n * numerator + original) / (2n * original);
      output.push({
        name,
        originalText: input.amount,
        scaledText: numerator > 0n && rounded === 0n ? '小於 0.001' : formatMilliUnits(rounded),
        unit,
        toTaste: false,
        approximate: numerator % original !== 0n
      });
    }
    return {
      ok: true,
      value: {
        originalServings: Number(original),
        targetServings: Number(target),
        rows: output,
        summary: { rowCount: output.length, scaledCount: output.length - toTasteCount, toTasteCount }
      }
    };
  } catch {
    return failure('INVALID_REQUEST');
  }
}
