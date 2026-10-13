import assert from 'node:assert/strict';
import { mkdir, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot, publicSourceFiles, productionFiles, exactTree, safeRead } from './files.mjs';
import { checkFrozen } from './check-frozen.mjs';
import { pages, productionHtml, productionRobots, productionHeadersText, productionSitemap } from './release-contract.mjs';

export async function expectedProduction() {
  await checkFrozen();
  const source = path.join(projectRoot, 'public');
  await exactTree(source, publicSourceFiles);
  const result = new Map();
  for (const file of productionFiles) {
    let bytes = await safeRead(source, file);
    const page = pages.find(page => page.file === file);
    if (page) bytes = Buffer.from(productionHtml(bytes.toString('utf8'), page));
    if (file === 'robots.txt') bytes = Buffer.from(productionRobots);
    if (file === '_headers') assert.equal(bytes.toString('utf8'), productionHeadersText);
    if (file === 'sitemap.xml') assert.equal(bytes.toString('utf8'), productionSitemap);
    result.set(file, bytes);
  }
  return result;
}
export async function buildProduction() {
  const destination = path.join(projectRoot, 'dist-production');
  const expected = await expectedProduction();
  try { await lstat(destination); await exactTree(destination, productionFiles); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const [file, bytes] of expected) {
    await mkdir(path.dirname(path.join(destination, file)), { recursive: true });
    await writeFile(path.join(destination, file), bytes);
  }
  await exactTree(destination, productionFiles);
  for (const [file, bytes] of expected) assert.ok((await safeRead(destination, file)).equals(bytes), `Production bytes: ${file}`);
  return expected;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--write-source-metadata' && process.argv.length === 3) {
    await writeFile(path.join(projectRoot, 'public/_headers'), productionHeadersText, { flag: 'wx' });
    await writeFile(path.join(projectRoot, 'public/sitemap.xml'), productionSitemap, { flag: 'wx' });
    console.log('Created fixed release source metadata.');
  } else {
    assert.equal(process.argv.length, 2, 'Production origin is fixed; no host override arguments.');
    const files = await buildProduction();
    console.log(`PASS: production candidate ${files.size} files; fixed origin; M1 protected bytes unchanged; no deployment.`);
  }
}
