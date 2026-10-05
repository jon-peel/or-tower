import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverlay, parsePosition } from '../src/server/overlay.ts';
import { parseMetar } from '../src/server/metar.ts';
import { countryFor, parseVatspy } from '../src/server/vatspy.ts';
import { divisionFor } from '../src/server/divisions.ts';
import type { VatsimFeed } from '../src/server/feed.ts';

const VATSPY = `[Countries]
South Africa|FA|Area
USA|KA|
USA|KZ|
[Airports]
;ICAO|Airport Name|Latitude Decimal|Longitude Decimal|IATA/LID|FIR|IsPseudo
FAOR|Johannesburg-OR Tambo Intl|-26.133694|28.242317||FAJA|0
KJFK|New York-John F. Kennedy Intl NY|40.63975|-73.778925|JFK|KZNY|0
[FIRs]
FAJA|Johannesburg ACC (Bandbox) - Johannesburg||FAJA
FAJA-C|Johannesburg ACC (Central) - Johannesburg|FAJA_C|FAJA-C
KZNY|New York|NY|KZNY
[UIRs]
`;

const spy = parseVatspy(VATSPY);

test('parseVatspy reads airports, cleans FIR names', () => {
  const faor = spy.airports.get('FAOR')!;
  assert.equal(faor.name, 'Johannesburg-OR Tambo Intl');
  assert.equal(faor.fir, 'FAJA');
  assert.equal(faor.iata, undefined);
  assert.equal(spy.firs.get('FAJA'), 'Johannesburg');
  assert.equal(spy.firs.get('KZNY'), 'New York');
});

test('countryFor uses two-letter prefix, falls back to unambiguous first letter', () => {
  assert.equal(countryFor(spy, 'FAOR'), 'South Africa');
  assert.equal(countryFor(spy, 'KJFK'), 'USA');
});

test('divisionFor maps prefixes with two-letter overrides', () => {
  assert.equal(divisionFor('FAOR')?.code, 'VATSSA');
  assert.equal(divisionFor('EGLL')?.code, 'VATUK');
  assert.equal(divisionFor('EDDF')?.code, 'VATEUD');
  assert.equal(divisionFor('KJFK')?.region, 'AMAS');
});

test('parsePosition derives ICAO and validates', () => {
  assert.deepEqual(parsePosition('faor_twr'), { callsign: 'FAOR_TWR', icao: 'FAOR' });
  assert.deepEqual(parsePosition('FAOR_N_APP'), { callsign: 'FAOR_N_APP', icao: 'FAOR' });
  assert.deepEqual(parsePosition('JNB_TWR', 'faor'), { callsign: 'JNB_TWR', icao: 'FAOR' });
  assert.throws(() => parsePosition(null));
  assert.throws(() => parsePosition('FAOR'));
  assert.throws(() => parsePosition('<script>_TWR'));
});

test('parseMetar extracts wind and QNH', () => {
  const m = parseMetar('FAOR 051300Z 34012KT CAVOK 22/02 Q1023 NOSIG');
  assert.equal(m.wind, '340/12KT');
  assert.equal(m.qnh, 'Q1023');
  const us = parseMetar('KJFK 051251Z VRB04G18KT 10SM FEW250 18/09 A3012');
  assert.equal(us.wind, 'VRB/4G18KT');
  assert.equal(us.qnh, 'A3012');
});

function feed(over: Partial<VatsimFeed> = {}): VatsimFeed {
  return {
    general: { update_timestamp: '2026-10-05T13:04:11Z' },
    pilots: [],
    controllers: [],
    atis: [],
    prefiles: [],
    facilities: [{ id: 4, short: 'TWR', long: 'Tower' }],
    ratings: [{ id: 3, short: 'S2', long: 'Tower Controller' }],
    ...over,
  };
}

test('buildOverlay: standby when position offline, still has airport info', () => {
  const p = buildOverlay({ callsign: 'FAOR_TWR', icao: 'FAOR' }, feed(), spy, undefined);
  assert.equal(p.status, 'standby');
  assert.equal(p.position.facility, 'Tower');
  assert.equal(p.position.frequency, undefined);
  assert.deepEqual(p.airport, {
    icao: 'FAOR', iata: 'JNB', name: 'Johannesburg-OR Tambo Intl', firName: 'Johannesburg',
    country: 'South Africa', division: 'VATSSA', region: 'EMEA',
  });
});

test('buildOverlay: live position with ATIS code', () => {
  const ctl = { callsign: 'FAOR_TWR', name: 'Test User', frequency: '118.100', facility: 4, rating: 3, logon_time: '2026-10-05T12:00:00Z' };
  const p = buildOverlay(
    { callsign: 'FAOR_TWR', icao: 'FAOR' },
    feed({ controllers: [ctl], atis: [{ ...ctl, callsign: 'FAOR_ATIS', atis_code: 'K' }] }),
    spy,
    undefined,
  );
  assert.equal(p.status, 'live');
  assert.equal(p.position.frequency, '118.100');
  assert.equal(p.position.rating, 'S2');
  assert.deepEqual(p.atis, { code: 'K' });
});

test('buildOverlay rejects unknown airports', () => {
  assert.throws(() => buildOverlay({ callsign: 'ZZZZ_TWR', icao: 'ZZZZ' }, feed(), spy, undefined), /Unknown airport/);
});
