import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { projectRoot, publicFiles, publicSourceFiles, sourceFiles, exactTree, safeRead } from './files.mjs';
import { checkFrozen } from './check-frozen.mjs';

assert.equal(process.versions.node.split('.')[0], '24', 'Node 24.x is required');
await checkFrozen();
await exactTree(path.join(projectRoot, 'public'), publicSourceFiles);
const packageJson = JSON.parse((await safeRead(projectRoot, 'package.json')).toString('utf8'));
assert.equal(packageJson.type, 'module');
assert.equal(Object.keys(packageJson.dependencies || {}).length, 0);
assert.equal(Object.keys(packageJson.devDependencies || {}).length, 0);
for (const file of sourceFiles) {
  const bytes = await safeRead(projectRoot, file);
  if (file.endsWith('.mjs')) {
    const result = spawnSync(process.execPath, ['--check', path.join(projectRoot, file)], { windowsHide: true, encoding: 'utf8' });
    assert.equal(result.status, 0, `Syntax check: ${file}`);
  }
  if (file.startsWith('public/js/')) {
    const source = bytes.toString('utf8');
    assert.doesNotMatch(source, /\b(?:eval|Function|fetch|XMLHttpRequest|WebSocket|Worker|EventSource|localStorage|sessionStorage|indexedDB)\b|\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|sendBeacon|document\.cookie|serviceWorker|\.download\b/);
  }
}
for (const [file, language, alternate] of [['index.html', 'zh-Hant', '/en/index.html'], ['en/index.html', 'en', '/index.html']]) {
  const html = (await safeRead(path.join(projectRoot, 'public'), file)).toString('utf8');
  assert.ok(html.includes(`<html lang="${language}">`));
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.equal((html.match(/<details>/g) || []).length, 5);
  assert.ok(html.includes(`href="${alternate}"`));
  assert.match(html, /<textarea id="report-text" readonly/);
  assert.match(html, /<textarea id="servings-original" rows="1" inputmode="numeric"/);
  assert.match(html, /<textarea id="servings-target" rows="1" inputmode="numeric"/);
  assert.doesNotMatch(html, /\bmaxlength\b|\son\w+=|<script(?! type="module" src="\/js\/app.mjs")/);
  const home = language === 'en' ? 'https://glossquote.com/en/index.html' : 'https://glossquote.com/index.html';
  assert.ok(html.includes(`class="brand" href="${home}"`));
  for (const url of [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1])) {
    assert.ok(url === home || url.startsWith('#') || publicFiles.includes(url.slice(1)), 'Only declared local assets, language links and matching-language family home');
  }
  for (const id of ['servings-original', 'servings-target', 'recipe-form', 'ingredients', 'calculate', 'copy', 'report-text', 'status', 'error-summary']) {
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, `Unique ID: ${id}`);
  }
}
assert.equal((await safeRead(path.join(projectRoot, 'public'), 'robots.txt')).toString('utf8'), 'User-agent: *\nDisallow: /\n');
console.log('PASS: Node 24; syntax; closed asset tree; zero dependencies; no network/storage/HTML sinks; bilingual noindex pages; full raw drafts.');
