import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { mkdir, mkdtemp, writeFile, link, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { startPreview, previewHeaders } from '../scripts/server.mjs';
import { projectRoot, publicFiles, safeRead, exactTree } from '../scripts/files.mjs';

function response(url, { method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    request.end();
  });
}
function close(server) { return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }

test('preview is loopback-only, closed GET/HEAD routes, declared MIME and noindex security headers', async () => {
  const preview = await startPreview({ port: 0 });
  try {
    assert.equal(preview.server.address().address, '127.0.0.1');
    for (const file of publicFiles) {
      const result = await response(`${preview.url}/${file}`);
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, await safeRead(path.join(projectRoot, 'public'), file));
      assert.match(result.headers['content-type'], /^(?:text\/html|text\/javascript|text\/css|text\/plain); charset=utf-8$/);
      for (const [name, value] of Object.entries(previewHeaders)) assert.equal(result.headers[name.toLowerCase()], value);
    }
    const head = await response(`${preview.url}/index.html`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.ok(Number(head.headers['content-length']) > 0);
    for (const route of ['/missing', '/package.json', '/scripts/server.mjs', '/js/stale.mjs', '/%2e%2e/AGENTS.md', '/%69ndex.html', '/%00', '/index.html/extra']) {
      assert.equal((await response(`${preview.url}${route}`)).status, 404);
    }
    const post = await response(`${preview.url}/index.html`, { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    assert.equal((await response(`${preview.url}/`)).status, 200);
    assert.equal((await response(`${preview.url}/en/`)).status, 200);
  } finally { await close(preview.server); }
});

test('occupied preferred port falls back to an OS-assigned loopback port without changing the existing server', async () => {
  const first = await startPreview({ port: 0 });
  let second;
  try {
    second = await startPreview({ port: first.port });
    assert.equal(second.fellBack, true);
    assert.notEqual(second.port, first.port);
    assert.equal(second.server.address().address, '127.0.0.1');
    assert.equal((await response(`${first.url}/index.html`)).status, 200);
    assert.equal((await response(`${second.url}/en/index.html`)).status, 200);
  } finally {
    if (second) await close(second.server);
    await close(first.server);
  }
});

test('file reader and closed tree reject traversal, actual hardlinks/junctions and stale files', async () => {
  const testRoot = path.join(projectRoot, 'test');
  const sandbox = await mkdtemp(path.join(testRoot, '.sandbox-'));
  try {
    await writeFile(path.join(sandbox, 'fixture.txt'), 'FAKE_ONLY\n');
    assert.equal((await safeRead(sandbox, 'fixture.txt')).toString(), 'FAKE_ONLY\n');
    for (const relative of ['../fixture.txt', '/fixture.txt', './/fixture.txt', 'folder\\fixture.txt']) {
      await assert.rejects(safeRead(sandbox, relative), /UNSAFE_FILE_PATH/);
    }
    await exactTree(sandbox, ['fixture.txt']);
    await writeFile(path.join(sandbox, 'stale.txt'), 'FAKE_STALE\n');
    await assert.rejects(exactTree(sandbox, ['fixture.txt']), /UNKNOWN_FILE/);
    await link(path.join(sandbox, 'fixture.txt'), path.join(sandbox, 'hardlink.txt'));
    await assert.rejects(safeRead(sandbox, 'fixture.txt'), /UNSAFE_FILE/);
    await assert.rejects(safeRead(sandbox, 'hardlink.txt'), /UNSAFE_FILE/);
    await mkdir(path.join(sandbox, 'target'));
    await writeFile(path.join(sandbox, 'target', 'fake.txt'), 'FAKE_ONLY\n');
    await symlink(path.join(sandbox, 'target'), path.join(sandbox, 'junction'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(safeRead(sandbox, 'junction/fake.txt'), /LINK_NOT_ALLOWED/);
  } finally {
    const relative = path.relative(testRoot, sandbox);
    assert.ok(relative.startsWith('.sandbox-') && !relative.includes(path.sep) && !path.isAbsolute(relative));
    await rm(sandbox, { recursive: true, force: true });
  }
});
