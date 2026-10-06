// Netlify Function: GET /api/tail/<ICAO airline code> → airline tail/emblem image.
// Netlify's edge keeps logos for a week (misses for an hour).

import { getTail } from '../../src/server/tails.ts';

export default async (_req: Request, context: { params: Record<string, string> }): Promise<Response> => {
  const code = (context.params.code ?? '').toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(code)) return new Response(null, { status: 404 });
  const img = await getTail(code);
  if (!img) {
    return new Response(null, { status: 404, headers: { 'netlify-cdn-cache-control': 'public, s-maxage=3600' } });
  }
  return new Response(new Uint8Array(img.body), {
    headers: {
      'content-type': img.type,
      'cache-control': 'public, max-age=86400',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=604800',
    },
  });
};

export const config = { path: '/api/tail/:code' };
