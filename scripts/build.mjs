import { mkdir, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot, publicFiles, publicSourceFiles, exactTree, safeRead } from './files.mjs';
import { checkFrozen } from './check-frozen.mjs';

const source = path.join(projectRoot, 'public');
const destination = path.join(projectRoot, 'dist');
await checkFrozen();
await exactTree(source, publicSourceFiles);
try {
  await lstat(destination);
  await exactTree(destination, publicFiles); // Reject unexpected stale files instead of deleting them.
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
for (const file of publicFiles) {
  await mkdir(path.dirname(path.join(destination, file)), { recursive: true });
  await writeFile(path.join(destination, file), await safeRead(source, file));
}
await exactTree(destination, publicFiles);
for (const file of publicFiles) {
  if (!(await safeRead(source, file)).equals(await safeRead(destination, file))) throw new Error('BUILD_BYTES_MISMATCH');
}
console.log(`PASS: offline preview build; ${publicFiles.length} allowlisted files; byte-identical to public; noindex/nofollow.`);
