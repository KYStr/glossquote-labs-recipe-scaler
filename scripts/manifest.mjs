import { createHash } from 'node:crypto';
import { mkdir, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot, publicFiles, publicSourceFiles, productionFiles, sourceFiles, contractFiles, exactTree, safeRead } from './files.mjs';
import { checkFrozen } from './check-frozen.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function manifest(kind, root, paths) {
  const files = [];
  for (const file of [...paths].sort()) {
    const bytes = await safeRead(root, file);
    files.push({ path: file, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const aggregate = files.map(file => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join('');
  return { schemaVersion: 1, kind, algorithm: 'sha256',
    digestDefinition: 'sha256(UTF-8 sorted path + NUL + byteLength + NUL + fileSha256 + LF)',
    fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), digest: sha256(aggregate), files };
}
await checkFrozen();
await exactTree(path.join(projectRoot, 'public'), publicSourceFiles);
await exactTree(path.join(projectRoot, 'dist'), publicFiles);
const manifests = {
  source: await manifest('implementation-source', projectRoot, sourceFiles),
  code: await manifest('browser-code', path.join(projectRoot, 'public'), publicFiles.filter(file => file.endsWith('.mjs') || file.endsWith('.css'))),
  runtime: await manifest('preview-runtime', path.join(projectRoot, 'public'), publicFiles),
  dist: await manifest('preview-dist', path.join(projectRoot, 'dist'), publicFiles)
};
try {
  await lstat(path.join(projectRoot, 'AGENTS.md'));
  manifests.contracts = await manifest('workspace-contracts', projectRoot, contractFiles);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await exactTree(path.join(projectRoot, 'dist-production'), productionFiles);
manifests.production = await manifest('production-candidate', path.join(projectRoot, 'dist-production'), productionFiles);
if (manifests.runtime.digest !== manifests.dist.digest) throw new Error('DIST_MANIFEST_MISMATCH');
if (process.argv.length > 2) {
  if (process.argv.length !== 4 || process.argv[2] !== '--out') throw new Error('USAGE: node scripts/manifest.mjs [--out directory]');
  const output = path.resolve(process.argv[3]);
  await mkdir(output, { recursive: true });
  for (const [kind, value] of Object.entries(manifests)) await writeFile(path.join(output, `${kind}-manifest.json`), `${JSON.stringify(value, null, 2)}\n`);
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(manifests).map(([kind, value]) => [kind,
  { fileCount: value.fileCount, totalBytes: value.totalBytes, digest: value.digest }])), null, 2));
