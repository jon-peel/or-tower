// Airline tail/emblem images for the board, by ICAO airline code (SAA, UAE, ...).
// Lookup order: assets/airlines/<CODE>.svg|png (your own), cached download in data/tails/,
// then the community set (Jxck-S/airline-logos, FlightAware logos), fetched once and cached.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { DATA_DIR, SERVERLESS } from './cache-dir.ts';

const UPSTREAM = 'https://raw.githubusercontent.com/Jxck-S/airline-logos/main/flightaware_logos/';
// Your own logos (assets/airlines/) only exist in a local checkout, not in a serverless bundle.
const LOCAL_DIR = SERVERLESS ? undefined : new URL('../../assets/airlines/', import.meta.url);
const CACHE_DIR = new URL('tails/', DATA_DIR);
const MISS_RETRY_MS = 7 * 24 * 3600_000; // re-check airlines without a logo weekly

export interface TailImage {
  body: Buffer;
  type: string;
}

/** "SAA335" → "SAA"; registrations and other non-airline callsigns → undefined. */
export function airlineCode(callsign: string): string | undefined {
  return /^([A-Z]{3})\d/.exec(callsign)?.[1];
}

const inflight = new Map<string, Promise<TailImage | undefined>>();

export function getTail(code: string): Promise<TailImage | undefined> {
  let p = inflight.get(code);
  if (!p) {
    p = resolve(code).finally(() => inflight.delete(code));
    inflight.set(code, p);
  }
  return p;
}

async function resolve(code: string): Promise<TailImage | undefined> {
  for (const [ext, type] of LOCAL_DIR ? ([['svg', 'image/svg+xml'], ['png', 'image/png']] as const) : []) {
    const local = await readFile(new URL(`${code}.${ext}`, LOCAL_DIR)).catch(() => undefined);
    if (local) return { body: local, type };
  }

  const cached = new URL(`${code}.png`, CACHE_DIR);
  const hit = await readFile(cached).catch(() => undefined);
  if (hit) return { body: hit, type: 'image/png' };

  const miss = new URL(`${code}.miss`, CACHE_DIR);
  const missAge = await stat(miss).then((s) => Date.now() - s.mtimeMs, () => Infinity);
  if (missAge < MISS_RETRY_MS) return undefined;

  let res: Response;
  try {
    res = await fetch(`${UPSTREAM}${code}.png`, { signal: AbortSignal.timeout(8_000) });
  } catch {
    return undefined; // network problem; try again next time
  }
  if (res.status === 404) {
    await cacheWrite(miss, '');
    return undefined;
  }
  if (!res.ok) return undefined; // transient; try again next time
  const body = Buffer.from(await res.arrayBuffer());
  await cacheWrite(cached, body);
  return { body, type: 'image/png' };
}

/** Best-effort: a read-only or full disk shouldn't stop logos being served. */
async function cacheWrite(file: URL, data: string | Buffer) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, data);
  } catch (err) {
    console.warn('tail cache write failed:', err);
  }
}
