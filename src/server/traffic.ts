// Derives the departures / arrivals board from raw feed data.
// VATSIM has no schedules or ETAs, so status is inferred from position and ground speed.

import type { ArrivalStatus, DepartureStatus, Flight } from '../shared/types.ts';
import type { Pilot, Prefile } from './feed.ts';
import { distanceNm } from './geo.ts';

const ON_GROUND_KT = 50; // below this we treat the aircraft as on the ground
const STATIONARY_KT = 5;
const AT_AIRPORT_NM = 10;
const JUST_DEPARTED_NM = 15;
const APPROACH_NM = 40;

const DEP_ORDER: Record<DepartureStatus, number> = { TAXI: 0, BOARDING: 1, DEPARTED: 2, SCHED: 3 };
const ARR_ORDER: Record<ArrivalStatus, number> = { APPROACH: 0, ENROUTE: 0, LANDED: 1 };

export interface AirportPoint {
  icao: string;
  lat: number;
  lon: number;
}

export function computeTraffic(pilots: Pilot[], prefiles: Prefile[], apt: AirportPoint) {
  const departures: (Flight & { sortKey: string })[] = [];
  const arrivals: Flight[] = [];

  for (const p of pilots) {
    const fp = p.flight_plan;
    if (!fp) continue;
    const nm = distanceNm(p.latitude, p.longitude, apt.lat, apt.lon);
    const onGround = p.groundspeed < ON_GROUND_KT;

    if (fp.departure === apt.icao) {
      let status: DepartureStatus | undefined;
      if (onGround && nm <= AT_AIRPORT_NM) status = p.groundspeed < STATIONARY_KT ? 'BOARDING' : 'TAXI';
      else if (!onGround && nm <= JUST_DEPARTED_NM) status = 'DEPARTED';
      if (status) {
        departures.push({ callsign: p.callsign, other: fp.arrival, aircraft: fp.aircraft_short, status, sortKey: p.logon_time });
      }
    }

    if (fp.arrival === apt.icao) {
      if (!onGround) {
        arrivals.push({
          callsign: p.callsign,
          other: fp.departure,
          aircraft: fp.aircraft_short,
          status: nm < APPROACH_NM ? 'APPROACH' : 'ENROUTE',
          etaMin: Math.round((nm / p.groundspeed) * 60),
        });
      } else if (nm <= AT_AIRPORT_NM) {
        arrivals.push({ callsign: p.callsign, other: fp.departure, aircraft: fp.aircraft_short, status: 'LANDED' });
      }
    }
  }

  for (const p of prefiles) {
    const fp = p.flight_plan;
    if (fp?.departure !== apt.icao) continue;
    departures.push({ callsign: p.callsign, other: fp.arrival, aircraft: fp.aircraft_short, status: 'SCHED', sortKey: fp.deptime });
  }

  departures.sort(
    (a, b) =>
      DEP_ORDER[a.status as DepartureStatus] - DEP_ORDER[b.status as DepartureStatus] || a.sortKey.localeCompare(b.sortKey),
  );
  arrivals.sort(
    (a, b) =>
      ARR_ORDER[a.status as ArrivalStatus] - ARR_ORDER[b.status as ArrivalStatus] || (a.etaMin ?? 0) - (b.etaMin ?? 0),
  );

  return {
    departures: departures.map(({ sortKey: _, ...f }) => f),
    arrivals,
  };
}
