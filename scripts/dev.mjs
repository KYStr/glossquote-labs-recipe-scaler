import { startPreview } from './server.mjs';

const preview = await startPreview();
console.log(JSON.stringify({ status: 'READY', host: '127.0.0.1', port: preview.port, fellBack: preview.fellBack,
  zh: `${preview.url}/index.html`, en: `${preview.url}/en/index.html`, pid: process.pid }));
// Only this process's own preview is closed if the caller terminates it.
process.once('SIGINT', () => preview.server.close());
process.once('SIGTERM', () => preview.server.close());
