// Netlify Function: GET /api/overlay?callsign=FAOR_TWR[&airport=FAOR]
// Same payload as the local server (server.ts). Netlify's edge caches it ~10s per position, so
// any number of open overlays share one VATSIM lookup.

import { BadRequest, getOverlay } from '../../src/server/overlay.ts';

export default async (req: Request): Promise<Response> => {
  const q = new URL(req.url).searchParams;
  try {
    const body = await getOverlay(q.get('callsign'), q.get('airport'));
    return Response.json(body, {
      headers: {
        'cache-control': 'no-store',
        'netlify-cdn-cache-control': 'public, s-maxage=10, stale-while-revalidate=20',
        'netlify-vary': 'query=callsign|airport',
      },
    });
  } catch (err) {
    if (err instanceof BadRequest) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: 'VATSIM data unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
};

export const config = { path: '/api/overlay' };
