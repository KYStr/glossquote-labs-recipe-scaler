import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { projectRoot, safeRead } from './files.mjs';
export async function checkFrozen() {
  const records = JSON.parse((await safeRead(projectRoot, 'scripts/m1-frozen.json')).toString('utf8'));
  assert.equal(records.length, 12);
  for (const record of records) {
    const bytes = await safeRead(projectRoot, record.path);
    assert.equal(bytes.length, record.bytes, `M1 frozen byte length: ${record.path}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, `M1 frozen hash: ${record.path}`);
  }
  return records;
}
