import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';
import { BadRequest, getOverlay } from './src/server/overlay.ts';

const PORT = Number(process.env.PORT ?? 3000);
const ROOT = new URL('.', import.meta.url);

// Public URL path → file on disk. Anything else is a 404.
const STATIC_DIRS: Record<string, string> = { '/dist/': 'dist/', '/assets/': 'assets/' };
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

async function sendFile(res: import('node:http').ServerResponse, relPath: string) {
  try {
    const body = await readFile(new URL(relPath, ROOT));
    res.writeHead(200, { 'content-type': MIME[extname(relPath)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

function sendJson(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (path === '/') return sendFile(res, 'public/index.html');

  if (path === '/api/overlay') {
    try {
      return sendJson(res, 200, await getOverlay(url.searchParams.get('callsign'), url.searchParams.get('airport')));
    } catch (err) {
      if (err instanceof BadRequest) return sendJson(res, 400, { error: err.message });
      console.error(err);
      return sendJson(res, 502, { error: 'VATSIM data unavailable' });
    }
  }

  for (const [prefix, dir] of Object.entries(STATIC_DIRS)) {
    if (path.startsWith(prefix)) {
      const rel = normalize(path.slice(prefix.length));
      if (rel.startsWith('..') || rel.includes('\0')) break;
      return sendFile(res, dir + rel);
    }
  }
  res.writeHead(404).end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`OR Tower overlay → http://localhost:${PORT}/`);
});
