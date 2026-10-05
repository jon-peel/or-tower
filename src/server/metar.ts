import type { CloudCover, FlightCategory, MetarInfo, Precip } from '../shared/types.ts';

const MAX_AGE_MS = 5 * 60_000;
const cache = new Map<string, { metar: MetarInfo | undefined; fetchedAt: number }>();

const COVER_RANK: Record<CloudCover, number> = { CLR: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4 };
const WEATHER = /^[-+]?(VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)*(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|SQ|FC|SS|DS)*$/;

export function parseMetar(raw: string): MetarInfo {
  const metar: MetarInfo = { raw, cover: 'CLR', precip: 'none', fog: false };

  const wind = raw.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\b/);
  if (wind) {
    const [, dir, speed, gust, unit] = wind;
    metar.wind = `${dir}/${Number(speed)}${gust ? `G${Number(gust)}` : ''}${unit === 'KT' ? 'KT' : 'MPS'}`;
  }
  const q = raw.match(/\bQ(\d{4})\b/);
  const a = raw.match(/\bA(\d{4})\b/);
  if (q) metar.qnh = `Q${q[1]}`;
  else if (a) metar.qnh = `A${a[1]}`;

  // Only the observation, not remarks or trend forecasts.
  const obs = raw.split(/\s(?:RMK|TEMPO|BECMG|NOSIG)\b/)[0];
  const tokens = obs.split(/\s+/).slice(2); // skip station + time

  let visSm: number | undefined;
  let ceilingFt: number | undefined;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'CAVOK') visSm = 10;
    else if (/^\d{4}$/.test(t)) visSm = Number(t) / 1609; // metres (9999 = 10 km+)
    else if (/^M?\d+(\/\d+)?SM$/.test(t)) {
      // "10SM", "1/2SM", "M1/4SM", or "1 1/2SM" split over two tokens
      let sm = fraction(t.replace(/^M|SM$/g, ''));
      if (/^\d+$/.test(tokens[i - 1] ?? '') && t.includes('/')) sm += Number(tokens[i - 1]);
      visSm = sm;
    }

    const cloud = t.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/);
    if (cloud) {
      const cover: CloudCover = cloud[1] === 'VV' ? 'OVC' : (cloud[1] as CloudCover);
      if (COVER_RANK[cover] > COVER_RANK[metar.cover]) metar.cover = cover;
      const base = Number(cloud[2]) * 100;
      if (COVER_RANK[cover] >= COVER_RANK.BKN) ceilingFt = Math.min(ceilingFt ?? Infinity, base);
    }

    if (WEATHER.test(t) && t.length >= 2 && !/^\d/.test(t)) {
      if (t.includes('TS')) metar.precip = 'storm';
      else if (/SN|SG|PL|IC|GS|GR/.test(t) && metar.precip !== 'storm') metar.precip = 'snow';
      else if (/RA|DZ/.test(t) && metar.precip === 'none') metar.precip = 'rain';
      if (/FG|BR/.test(t)) metar.fog = true;
    }
  }

  if (visSm !== undefined || ceilingFt !== undefined) metar.category = flightCategory(visSm ?? 10, ceilingFt ?? Infinity);
  return metar;
}

function fraction(s: string): number {
  const [n, d] = s.split('/').map(Number);
  return d ? n / d : n;
}

/** FAA flight categories from visibility (statute miles) and ceiling (ft). */
export function flightCategory(visSm: number, ceilingFt: number): FlightCategory {
  if (ceilingFt < 500 || visSm < 1) return 'LIFR';
  if (ceilingFt < 1000 || visSm < 3) return 'IFR';
  if (ceilingFt <= 3000 || visSm <= 5) return 'MVFR';
  return 'VFR';
}

/** Fetches and caches the VATSIM METAR; returns undefined if unavailable. */
export async function getMetar(icao: string): Promise<MetarInfo | undefined> {
  const hit = cache.get(icao);
  if (hit && Date.now() - hit.fetchedAt < MAX_AGE_MS) return hit.metar;
  try {
    const res = await fetch(`https://metar.vatsim.net/${icao}`, { signal: AbortSignal.timeout(5_000) });
    const text = res.ok ? (await res.text()).trim() : '';
    const metar = text.startsWith(icao) ? parseMetar(text) : undefined;
    cache.set(icao, { metar, fetchedAt: Date.now() });
    return metar;
  } catch {
    return hit?.metar;
  }
}
