import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import path from 'node:path';
import { projectRoot, productionFiles, publicFiles, safeRead, exactTree } from './files.mjs';
import { expectedProduction } from './production.mjs';
import { startProductionPreview, productionMime } from './serve-production.mjs';
import { pages, jsonLdText, securityHeaders, productionHeadersText, productionSitemap, productionRobots } from './release-contract.mjs';

const expectedUrls = ['https://recipe.glossquote.com/index.html', 'https://recipe.glossquote.com/en/index.html'];
const expectedTitles = ['食譜份量換算：按人數調整食材用量 | GlossQuote', 'Recipe Scaler: Adjust Ingredient Quantities by Servings | GlossQuote'];
const expectedLanguages = ['zh-Hant', 'en'];
const expectedHomes = ['https://glossquote.com/index.html', 'https://glossquote.com/en/index.html'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function count(html, pattern, expected) { assert.equal([...html.matchAll(pattern)].length, expected); }
function response(url, { method = 'GET', host = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers: { Host: host } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end();
  });
}
const root = path.join(projectRoot, 'dist-production');
assert.deepEqual(pages.map(page => page.language), expectedLanguages);
await exactTree(root, productionFiles);
const expected = await expectedProduction();
for (const [file, bytes] of expected) assert.ok((await safeRead(root, file)).equals(bytes), `Deterministic build bytes: ${file}`);
for (let index = 0; index < pages.length; index += 1) {
  const page = pages[index];
  const source = (await safeRead(path.join(projectRoot, 'public'), page.file)).toString('utf8');
  const html = (await safeRead(root, page.file)).toString('utf8');
  assert.match(source, /<meta name="robots" content="noindex,nofollow">/);
  assert.ok(!source.includes('rel="canonical"') && !source.includes('application/ld+json'));
  assert.ok(html.includes(`<html lang="${expectedLanguages[index]}">`));
  assert.ok(html.includes(`<title>${expectedTitles[index]}</title>`));
  assert.ok(html.includes('<meta name="robots" content="index,follow">'));
  count(html, /<link rel="canonical"[^>]+>/g, 1);
  assert.ok(html.includes(`<link rel="canonical" href="${expectedUrls[index]}">`));
  count(html, /<link rel="alternate" hreflang=/g, 3);
  for (let other = 0; other < 2; other += 1) assert.ok(html.includes(`<link rel="alternate" hreflang="${expectedLanguages[other]}" href="${expectedUrls[other]}">`));
  assert.ok(html.includes(`<link rel="alternate" hreflang="x-default" href="${expectedUrls[0]}">`));
  assert.ok(html.includes(`<meta property="og:url" content="${expectedUrls[index]}">`));
  assert.ok(html.includes(`class="brand" href="${expectedHomes[index]}"`));
  const data = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(data.length, 1);
  assert.equal(data[0][1], jsonLdText(page));
  const structured = JSON.parse(data[0][1]);
  assert.equal(structured['@type'], 'WebApplication'); assert.equal(structured.url, expectedUrls[index]);
  assert.equal(structured.inLanguage, expectedLanguages[index]);
  assert.equal(Object.hasOwn(structured, 'aggregateRating'), false);
  assert.ok(securityHeaders['Content-Security-Policy'].includes(`'sha256-${createHash('sha256').update(data[0][1]).digest('base64')}'`));
  count(html, /<script\b/g, 2);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|\son\w+=|\.workers\.dev|localhost|127\.0\.0\.1/);
  const sourceBody = source.match(/<body>[\s\S]*?<\/body>/)[0];
  const expectedBody = sourceBody.replace(' · 本機預覽</footer>', '</footer>').replace(' · Local preview</footer>', '</footer>');
  assert.equal(html.match(/<body>[\s\S]*?<\/body>/)[0], expectedBody, 'Only environment footer differs from the preview body');
  for (const url of [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1])) {
    assert.ok(expectedUrls.includes(url) || expectedHomes.includes(url) || url.startsWith('#') || publicFiles.includes(url.slice(1)), `Declared asset/link: ${url}`);
  }
}
assert.equal((await safeRead(root, '_headers')).toString('utf8'), productionHeadersText);
assert.equal((await safeRead(root, 'sitemap.xml')).toString('utf8'), productionSitemap);
assert.equal((await safeRead(root, 'robots.txt')).toString('utf8'), productionRobots);
assert.deepEqual([...productionSitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), expectedUrls);
const config = JSON.parse((await safeRead(projectRoot, 'wrangler.jsonc')).toString('utf8'));
assert.deepEqual(config, { name: 'glossquote-labs-recipe-scaler', compatibility_date: '2026-10-13', workers_dev: false,
  preview_urls: false, send_metrics: false, assets: { directory: './dist-production', html_handling: 'none', not_found_handling: '404-page' },
  routes: [{ pattern: 'recipe.glossquote.com', custom_domain: true }],
  observability: { enabled: false, logs: { enabled: false }, traces: { enabled: false } } });
const preview = await startProductionPreview();
const httpEvidence = [];
try {
  assert.equal(preview.server.address().address, '127.0.0.1');
  for (const file of productionFiles.filter(file => !file.startsWith('_'))) {
    const res = await response(`${preview.url}/${file}`);
    assert.equal(res.status, file === '404.html' ? 404 : 200);
    assert.equal(res.headers['content-type'], productionMime[path.extname(file)]);
    for (const [key, value] of Object.entries(securityHeaders)) assert.equal(res.headers[key.toLowerCase()], value);
    assert.ok(res.bytes.equals(await safeRead(root, file)));
    const head = await response(`${preview.url}/${file}`, { method: 'HEAD' });
    assert.equal(head.status, res.status); assert.equal(head.bytes.length, 0);
    assert.equal(Number(head.headers['content-length']), res.bytes.length);
    httpEvidence.push({ file, status: res.status, bytes: res.bytes.length, sha256: sha256(res.bytes), mime: res.headers['content-type'] });
  }
  for (const route of ['/not-a-page', '/en/not-a-page', '/_headers', '/package.json', '/%2e%2e/HANDOFF.md', '/js/stale.mjs']) {
    const res = await response(`${preview.url}${route}`);
    assert.equal(res.status, 404); assert.ok(res.bytes.equals(await safeRead(root, '404.html')));
    assert.equal(res.headers['x-robots-tag'], 'noindex, nofollow');
  }
  for (const page of pages) {
    const res = await response(`${preview.url}/${page.file}?canonical=https://untrusted.invalid/`, { host: 'untrusted.invalid' });
    assert.equal(res.status, 200); assert.ok(res.bytes.equals(await safeRead(root, page.file)), 'Host/query cannot alter fixed canonical bytes');
  }
  const post = await response(`${preview.url}/index.html`, { method: 'POST' });
  assert.equal(post.status, 405); assert.equal(post.headers.allow, 'GET, HEAD');
} finally { await new Promise((resolve, reject) => preview.server.close(error => error ? reject(error) : resolve())); }
console.log(JSON.stringify({ status: 'PASS', scope: 'Offline deterministic candidate and real loopback Node HTTP; not a deployed Cloudflare runtime.',
  seo: 'fixed bilingual canonical/hreflang/x-default/OG/JSON-LD', csp: 'exact SHA-256 hashes; no unsafe-inline/eval',
  m1ProtectedFiles: 12, http: httpEvidence, actualCloudflareHttp: 'NOT_RUN_M3', wranglerDryRun: 'NOT_RUN_NOT_REQUIRED' }, null, 2));
