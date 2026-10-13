import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot, productionFiles, exactTree, safeRead } from './files.mjs';
import { securityHeaders } from './release-contract.mjs';

export const productionMime = Object.freeze({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' });

// Real loopback HTTP over the fixed candidate bytes, not a Cloudflare runtime.
// The platform's assets-only 404/MIME/header behavior is verified after M3.
export async function startProductionPreview() {
  const root = path.join(projectRoot, 'dist-production');
  await exactTree(root, productionFiles);
  const routes = new Map(productionFiles.filter(file => !file.startsWith('_')).map(file => [`/${file}`, file]));
  routes.set('/', 'index.html'); routes.set('/en/', 'en/index.html');
  const server = createServer(async (request, response) => {
    const fixedError = (status, text) => {
      const bytes = Buffer.from(text);
      response.writeHead(status, { ...securityHeaders, 'X-Robots-Tag': 'noindex, nofollow',
        'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD'); fixedError(405, 'Method not allowed.'); return;
    }
    const raw = request.url || '';
    const pathname = raw.split('?')[0];
    const found = raw.length <= 2048 && routes.has(pathname);
    const file = found ? routes.get(pathname) : '404.html';
    const status = found && file !== '404.html' ? 200 : 404;
    try {
      const bytes = await safeRead(root, file);
      const headers = { ...securityHeaders, 'Content-Type': productionMime[path.extname(file)], 'Content-Length': bytes.length };
      if (status === 404) headers['X-Robots-Tag'] = 'noindex, nofollow';
      else if (file.endsWith('.html')) headers['X-Robots-Tag'] = 'index, follow';
      response.writeHead(status, headers);
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { fixedError(500, 'Candidate file unavailable.'); }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxHeadersCount = 32;
  await new Promise((resolve, reject) => {
    server.once('error', reject); server.listen({ host: '127.0.0.1', port: 0 }, resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}`, port: server.address().port };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const preview = await startProductionPreview();
  console.log(JSON.stringify({ status: 'READY', mode: 'local-production-candidate-not-Cloudflare', url: preview.url,
    zh: `${preview.url}/index.html`, en: `${preview.url}/en/index.html`, pid: process.pid }));
  process.once('SIGINT', () => preview.server.close());
  process.once('SIGTERM', () => preview.server.close());
}
