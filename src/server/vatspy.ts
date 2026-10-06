// Static airport / FIR / country data from the VATSpy data project.
// Downloaded once and cached in data/; refreshed weekly.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { DATA_DIR } from './cache-dir.ts';

const VATSPY_URL = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/VATSpy.dat';
const CACHE_FILE = new URL('VATSpy.dat', DATA_DIR);
const MAX_AGE_MS = 7 * 24 * 3600_000;

export interface Airport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  iata?: string;
  fir: string;
}

export interface VatspyData {
  airports: Map<string, Airport>;
  /** FIR ICAO → display name, e.g. FAJA → "Johannesburg". */
  firs: Map<string, string>;
  /** ICAO prefix (usually two letters) → country name. */
  countries: Map<string, string>;
}

export function parseVatspy(text: string): VatspyData {
  const data: VatspyData = { airports: new Map(), firs: new Map(), countries: new Map() };
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    if (line.startsWith('[')) {
      section = line;
      continue;
    }
    const f = line.split('|');
    if (section === '[Countries]') {
      data.countries.set(f[1], f[0]);
    } else if (section === '[Airports]') {
      // ICAO|Name|Lat|Lon|IATA/LID|FIR|IsPseudo
      if (f[6] === '1' || data.airports.has(f[0])) continue;
      data.airports.set(f[0], { icao: f[0], name: f[1], lat: Number(f[2]), lon: Number(f[3]), iata: f[4] || undefined, fir: f[5] });
    } else if (section === '[FIRs]') {
      // ICAO|Name|CallsignPrefix|Boundary — first entry per ICAO is the main one.
      if (!data.firs.has(f[0])) data.firs.set(f[0], cleanFirName(f[1]));
    }
  }
  return data;
}

/** "Johannesburg ACC (Bandbox) - Johannesburg" → "Johannesburg". */
function cleanFirName(name: string): string {
  const parts = name.split(' - ');
  return parts[parts.length - 1].trim();
}

export function countryFor(data: VatspyData, icao: string): string | undefined {
  const exact = data.countries.get(icao.slice(0, 2));
  if (exact) return exact;
  // Some countries only list e.g. KA/KZ; fall back to the first letter when it's unambiguous.
  const names = new Set([...data.countries].filter(([p]) => p[0] === icao[0]).map(([, n]) => n));
  return names.size === 1 ? [...names][0] : undefined;
}

let loaded: Promise<VatspyData> | undefined;

export function getVatspy(): Promise<VatspyData> {
  loaded ??= load().catch((err) => {
    loaded = undefined;
    throw err;
  });
  return loaded;
}

async function load(): Promise<VatspyData> {
  const age = await stat(CACHE_FILE).then((s) => Date.now() - s.mtimeMs, () => Infinity);
  if (age > MAX_AGE_MS) {
    try {
      const res = await fetch(VATSPY_URL, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`VATSpy HTTP ${res.status}`);
      const text = await res.text();
      // Caching is best-effort: a read-only disk shouldn't stop the overlay working.
      await mkdir(new URL('.', CACHE_FILE), { recursive: true })
        .then(() => writeFile(CACHE_FILE, text))
        .catch((err) => console.warn('VATSpy cache write failed:', err));
      return parseVatspy(text);
    } catch (err) {
      if (age === Infinity) throw err;
      console.warn('VATSpy refresh failed, using cached copy:', err);
    }
  }
  return parseVatspy(await readFile(CACHE_FILE, 'utf8'));
}
