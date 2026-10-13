import { createServer } from 'node:http';
import path from 'node:path';
import { projectRoot, publicFiles, publicSourceFiles, exactTree, safeRead } from './files.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
export const previewHeaders = Object.freeze({
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'none'; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), clipboard-write=(self)'
});

export async function startPreview({ port = 4200, fallback = true, root = path.join(projectRoot, 'public') } = {}) {
  await exactTree(root, publicSourceFiles);
  const routes = new Map(publicFiles.map(file => [`/${file}`, file]));
  routes.set('/', 'index.html');
  routes.set('/en/', 'en/index.html');
  const server = createServer(async (request, response) => {
    for (const [name, value] of Object.entries(previewHeaders)) response.setHeader(name, value);
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed.');
      return;
    }
    // No normalization that could turn an unknown/traversal route into a file.
    const pathname = (request.url || '').split('?')[0];
    const relative = routes.get(pathname);
    if (!relative) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : 'Not found.');
      return;
    }
    try {
      const bytes = await safeRead(root, relative);
      response.writeHead(200, { 'Content-Type': mime[path.extname(relative)], 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : 'Preview file unavailable.');
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 32;
  let fellBack = false;
  await new Promise((resolve, reject) => {
    const onError = error => {
      if (error.code === 'EADDRINUSE' && fallback && port !== 0 && !fellBack) {
        fellBack = true;
        server.listen({ host: '127.0.0.1', port: 0 });
      } else reject(new Error('PREVIEW_LISTEN_FAILED'));
    };
    server.on('error', onError);
    server.once('listening', () => { server.removeListener('error', onError); resolve(); });
    server.listen({ host: '127.0.0.1', port });
  });
  return { server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}`, fellBack };
}
