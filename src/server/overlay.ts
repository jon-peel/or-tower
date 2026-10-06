// Composes the /api/overlay payload from the feed, VATSpy data and METAR.

import type { MetarInfo, OverlayPayload } from '../shared/types.ts';
import { divisionFor, IATA_OVERRIDES } from './divisions.ts';
import { getFeed, type VatsimFeed } from './feed.ts';
import { eventFor, getEvents, type VatsimEvent } from './events.ts';
import { getMetar } from './metar.ts';
import { runwaysInUse } from './runways.ts';
import { skyPhase } from './sun.ts';
import { computeTraffic } from './traffic.ts';
import { countryFor, getVatspy, type VatspyData } from './vatspy.ts';

const BOARD_ROWS = 3;

export class BadRequest extends Error {}

/** "faor_twr" → { callsign: "FAOR_TWR", icao: "FAOR" }; `airport` overrides the derived ICAO. */
export function parsePosition(callsign: string | null, airport?: string | null) {
  const cs = (callsign ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}(_+[A-Z0-9]+)*_+[A-Z]{2,4}$/.test(cs)) throw new BadRequest(`Invalid position callsign "${callsign ?? ''}"`);
  const icao = (airport?.trim() || cs.split('_')[0]).toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(icao)) throw new BadRequest(`Invalid airport "${icao}"`);
  return { callsign: cs, icao };
}

export function buildOverlay(
  pos: { callsign: string; icao: string },
  feed: VatsimFeed,
  spy: VatspyData,
  metar: MetarInfo | undefined,
  events: VatsimEvent[] = [],
  now = new Date(),
): OverlayPayload {
  const apt = spy.airports.get(pos.icao);
  if (!apt) throw new BadRequest(`Unknown airport ${pos.icao}`);

  const ctl = feed.controllers.find((c) => c.callsign === pos.callsign);
  const facilityShort = pos.callsign.split('_').at(-1)!;
  const facility = ctl
    ? feed.facilities.find((f) => f.id === ctl.facility)?.long
    : feed.facilities.find((f) => f.short === facilityShort)?.long;
  const atisList = feed.atis.filter((a) => a.callsign.startsWith(`${pos.icao}_`));
  const atis = atisList.find((a) => a.atis_code);
  const div = divisionFor(pos.icao);
  const { departures, arrivals } = computeTraffic(feed.pilots, feed.prefiles, apt);

  return {
    status: ctl ? 'live' : 'standby',
    sky: skyPhase(apt.lat, apt.lon, now),
    position: {
      callsign: pos.callsign,
      facility: facility ?? facilityShort,
      frequency: ctl?.frequency,
      name: ctl?.name,
      rating: ctl ? feed.ratings.find((r) => r.id === ctl.rating)?.short : undefined,
      logonTime: ctl?.logon_time,
    },
    airport: {
      icao: apt.icao,
      iata: IATA_OVERRIDES[apt.icao] ?? apt.iata,
      name: apt.name,
      firName: spy.firs.get(apt.fir),
      country: countryFor(spy, apt.icao),
      division: div?.code,
      region: div?.region,
    },
    atis: atis?.atis_code ? { code: atis.atis_code } : undefined,
    runways: runwaysInUse(atisList),
    event: eventFor(events, apt.icao, now.getTime()),
    metar,
    departures: departures.slice(0, BOARD_ROWS),
    arrivals: arrivals.slice(0, BOARD_ROWS),
    updatedAt: feed.general.update_timestamp,
  };
}

export async function getOverlay(callsign: string | null, airport: string | null): Promise<OverlayPayload> {
  const pos = parsePosition(callsign, airport);
  const [feed, spy, metar, events] = await Promise.all([getFeed(), getVatspy(), getMetar(pos.icao), getEvents()]);
  return buildOverlay(pos, feed, spy, metar, events);
}
