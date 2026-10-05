import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTraffic } from '../src/server/traffic.ts';
import { distanceNm } from '../src/server/geo.ts';
import type { Pilot, Prefile } from '../src/server/feed.ts';

const FAOR = { icao: 'FAOR', lat: -26.133694, lon: 28.242317 };

// Roughly 1 nm of latitude = 1/60 degree.
const north = (nm: number) => FAOR.lat + nm / 60;

function pilot(callsign: string, o: Partial<Pilot> & { dep?: string; arr?: string; nm?: number }): Pilot {
  return {
    callsign,
    latitude: north(o.nm ?? 0),
    longitude: FAOR.lon,
    altitude: o.altitude ?? 5500,
    groundspeed: o.groundspeed ?? 0,
    logon_time: o.logon_time ?? '2026-10-05T10:00:00Z',
    flight_plan: { departure: o.dep ?? 'FAOR', arrival: o.arr ?? 'FACT', aircraft_short: 'B738', deptime: '1200' },
  };
}

test('distanceNm is about 60 nm per degree of latitude', () => {
  const d = distanceNm(0, 0, 1, 0);
  assert.ok(Math.abs(d - 60) < 0.2, `got ${d}`);
});

test('departure status from ground speed and distance', () => {
  const { departures } = computeTraffic(
    [
      pilot('PARKED', { groundspeed: 0 }),
      pilot('TAXIING', { groundspeed: 15 }),
      pilot('CLIMB', { groundspeed: 220, nm: 8 }),
      pilot('GONE', { groundspeed: 450, nm: 80 }),
      pilot('ELSEWHERE', { dep: 'FACT', arr: 'FALE' }),
    ],
    [],
    FAOR,
  );
  assert.deepEqual(
    departures.map((f) => [f.callsign, f.status]),
    [
      ['TAXIING', 'TAXI'],
      ['PARKED', 'BOARDING'],
      ['CLIMB', 'DEPARTED'],
    ],
  );
  assert.equal(departures[0].other, 'FACT');
  assert.equal(departures[0].aircraft, 'B738');
});

test('boarding flights ordered by logon time, prefiles last by deptime', () => {
  const prefiles: Prefile[] = [
    { callsign: 'PRE2', flight_plan: { departure: 'FAOR', arrival: 'FALE', aircraft_short: 'A320', deptime: '1500' } },
    { callsign: 'PRE1', flight_plan: { departure: 'FAOR', arrival: 'FALE', aircraft_short: 'A320', deptime: '1400' } },
    { callsign: 'NOTHERE', flight_plan: { departure: 'FACT', arrival: 'FAOR', aircraft_short: 'A320', deptime: '1400' } },
  ];
  const { departures } = computeTraffic(
    [
      pilot('LATE', { logon_time: '2026-10-05T11:00:00Z' }),
      pilot('EARLY', { logon_time: '2026-10-05T09:00:00Z' }),
    ],
    prefiles,
    FAOR,
  );
  assert.deepEqual(
    departures.map((f) => f.callsign),
    ['EARLY', 'LATE', 'PRE1', 'PRE2'],
  );
  assert.equal(departures[2].status, 'SCHED');
});

test('arrivals: ETA from distance and ground speed, sorted soonest first', () => {
  const { arrivals } = computeTraffic(
    [
      pilot('FAR', { dep: 'EGLL', arr: 'FAOR', groundspeed: 480, nm: 480 }),
      pilot('CLOSE', { dep: 'FACT', arr: 'FAOR', groundspeed: 180, nm: 30 }),
      pilot('DOWN', { dep: 'FALE', arr: 'FAOR', groundspeed: 10, nm: 1 }),
      pilot('ATORIGIN', { dep: 'FACT', arr: 'FAOR', groundspeed: 0, nm: 600 }),
    ],
    [],
    FAOR,
  );
  assert.deepEqual(
    arrivals.map((f) => [f.callsign, f.status, f.etaMin]),
    [
      ['CLOSE', 'APPROACH', 10],
      ['FAR', 'ENROUTE', 60],
      ['DOWN', 'LANDED', undefined],
    ],
  );
  assert.equal(arrivals[0].other, 'FACT');
});

test('pilots without a flight plan are ignored', () => {
  const p = pilot('NOFP', {});
  delete p.flight_plan;
  const { departures, arrivals } = computeTraffic([p], [], FAOR);
  assert.equal(departures.length + arrivals.length, 0);
});

test('airline code from callsign; registrations have none', async () => {
  const { airlineCode } = await import('../src/server/tails.ts');
  assert.equal(airlineCode('SAA335'), 'SAA');
  assert.equal(airlineCode('UAE37R'), 'UAE');
  assert.equal(airlineCode('ZSABC'), undefined);
  assert.equal(airlineCode('N123AB'), undefined);
  assert.equal(airlineCode('GDEFG'), undefined);
});

test('flights carry the airline code', () => {
  const { departures } = computeTraffic([pilot('SAA335', { groundspeed: 0 }), pilot('ZSABC', { groundspeed: 0 })], [], FAOR);
  assert.deepEqual(departures.map((f) => f.airline), ['SAA', undefined]);
});
