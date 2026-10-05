// Solar elevation from a low-precision almanac (good to ~0.1°, plenty for picking a sky colour).

import type { SkyPhase } from '../shared/types.ts';

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Returns the sun's elevation in degrees and whether it is rising (morning). */
export function sunPosition(lat: number, lon: number, when: Date) {
  const d = when.getTime() / 86_400_000 - 10_957.5; // days since J2000.0
  const g = rad(357.529 + 0.98560028 * d); // mean anomaly
  const q = 280.459 + 0.98564736 * d; // mean longitude
  const L = rad(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)); // ecliptic longitude
  const e = rad(23.439 - 0.00000036 * d); // obliquity
  const ra = deg(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15;
  const hourAngle = ((((gmst + lon - ra) % 360) + 540) % 360) - 180; // −180..180, negative = morning
  const h = rad(hourAngle);
  const elevation = deg(Math.asin(Math.sin(rad(lat)) * Math.sin(dec) + Math.cos(rad(lat)) * Math.cos(dec) * Math.cos(h)));
  return { elevation, rising: hourAngle < 0 };
}

/** Day above +6°, night below −6° (civil twilight), dawn/dusk in between. */
export function skyPhase(lat: number, lon: number, when: Date): SkyPhase {
  const { elevation, rising } = sunPosition(lat, lon, when);
  if (elevation > 6) return 'day';
  if (elevation < -6) return 'night';
  return rising ? 'dawn' : 'dusk';
}
