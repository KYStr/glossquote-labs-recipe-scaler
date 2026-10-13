import { lstat, realpath, open, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const publicFiles = Object.freeze([
  'index.html', 'en/index.html', 'robots.txt', 'styles/app.css',
  'js/app.mjs', 'js/i18n.mjs', 'js/view.mjs', 'js/core/editor.mjs',
  'js/core/recipe.mjs', 'js/core/report.mjs', 'js/core/session.mjs'
].sort());
// Keep the M1 preview runtime and its tests unchanged. Release-only source
// files are validated as a separate closed tree and never served by preview.
export const publicSourceFiles = Object.freeze([...publicFiles, '404.html', '_headers', 'sitemap.xml'].sort());
export const productionFiles = publicSourceFiles;
export const sourceFiles = Object.freeze([
  '.gitignore', 'package.json', 'wrangler.jsonc', ...publicSourceFiles.map(file => `public/${file}`),
  'scripts/files.mjs', 'scripts/server.mjs', 'scripts/dev.mjs', 'scripts/build.mjs',
  'scripts/check.mjs', 'scripts/manifest.mjs',
  'scripts/release-contract.mjs', 'scripts/m1-frozen.json', 'scripts/check-frozen.mjs',
  'scripts/production.mjs', 'scripts/check-production.mjs', 'scripts/serve-production.mjs',
  'test/core.test.mjs', 'test/session.test.mjs', 'test/server.test.mjs', 'test/fixtures/oracles.json'
].sort());
export const contractFiles = Object.freeze([
  'AGENTS.md', 'PRODUCT.md', 'TECHNICAL.md', 'ACCEPTANCE.md', 'UX-SEO.md', 'TASKS.md',
  'docs/BRAND.md', 'docs/DESIGN-SYSTEM.md', 'docs/ENGINEERING.md', 'docs/PRIVACY-SECURITY.md', 'docs/RELEASE.md'
].sort());

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function safeRead(root, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('UNSAFE_FILE_PATH');
  }
  const absoluteRoot = path.resolve(root);
  const rootStat = await lstat(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('UNSAFE_FILE_ROOT');
  const physicalRoot = await realpath(absoluteRoot);
  let target = absoluteRoot;
  const parts = relative.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    target = path.join(target, parts[index]);
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) throw new Error('LINK_NOT_ALLOWED');
    if (index < parts.length - 1 && !stat.isDirectory()) throw new Error('UNSAFE_FILE_PATH');
    if (index === parts.length - 1 && (!stat.isFile() || stat.nlink !== 1)) throw new Error('UNSAFE_FILE');
    if (!inside(physicalRoot, await realpath(target))) throw new Error('FILE_ESCAPE');
  }
  const handle = await open(target, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || !inside(physicalRoot, await realpath(target))) throw new Error('UNSAFE_FILE');
    return await handle.readFile();
  } finally { await handle.close(); }
}

export async function exactTree(root, expected) {
  const allowed = new Set(expected);
  const found = [];
  async function visit(relative = '') {
    const directory = path.join(root, relative);
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('UNSAFE_DIRECTORY');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error('LINK_NOT_ALLOWED');
      if (entry.isDirectory()) {
        if (![...allowed].some(item => item.startsWith(`${file}/`))) throw new Error('UNKNOWN_DIRECTORY');
        await visit(file);
      } else {
        if (!allowed.has(file)) throw new Error('UNKNOWN_FILE');
        await safeRead(root, file);
        found.push(file);
      }
    }
  }
  await visit();
  if (found.length !== expected.length || expected.some(file => !found.includes(file))) throw new Error('MISSING_FILE');
  return found.sort();
}
