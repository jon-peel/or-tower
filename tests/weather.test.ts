import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyPhase, sunPosition } from '../src/server/sun.ts';
import { flightCategory, parseMetar } from '../src/server/metar.ts';

const FAOR = { lat: -26.133694, lon: 28.242317 }; // SAST = UTC+2

test('sun is overhead at the equator at noon UTC on the equinox, below at midnight', () => {
  assert.ok(sunPosition(0, 0, new Date('2026-03-20T12:07:00Z')).elevation > 85);
  assert.ok(sunPosition(0, 0, new Date('2026-03-20T00:07:00Z')).elevation < -85);
});

test('sky phase at FAOR through the day (sunrise ~05:40 SAST, sunset ~18:05 SAST in October)', () => {
  const at = (utc: string) => skyPhase(FAOR.lat, FAOR.lon, new Date(`2026-10-05T${utc}Z`));
  assert.equal(at('01:00'), 'night');
  assert.equal(at('03:45'), 'dawn');
  assert.equal(at('10:00'), 'day');
  assert.equal(at('16:10'), 'dusk');
  assert.equal(at('20:00'), 'night');
});

test('flight category thresholds', () => {
  assert.equal(flightCategory(10, Infinity), 'VFR');
  assert.equal(flightCategory(10, 3000), 'MVFR');
  assert.equal(flightCategory(4, Infinity), 'MVFR');
  assert.equal(flightCategory(2, Infinity), 'IFR');
  assert.equal(flightCategory(10, 800), 'IFR');
  assert.equal(flightCategory(0.5, Infinity), 'LIFR');
  assert.equal(flightCategory(10, 300), 'LIFR');
});

test('METAR: CAVOK is clear VFR', () => {
  const m = parseMetar('FAOR 051300Z 34012KT CAVOK 22/02 Q1023 NOSIG');
  assert.equal(m.category, 'VFR');
  assert.equal(m.cover, 'CLR');
  assert.equal(m.precip, 'none');
  assert.equal(m.fog, false);
});

test('METAR: metric visibility and broken ceiling', () => {
  const m = parseMetar('FAOR 051300Z 18008KT 4000 -RA BKN008 OVC020 12/11 Q1019');
  assert.equal(m.cover, 'OVC');
  assert.equal(m.precip, 'rain');
  assert.equal(m.category, 'IFR'); // ceiling 800 ft
});

test('METAR: thunderstorm beats rain, CB group is not weather', () => {
  const m = parseMetar('FAOR 051500Z 27015G28KT 9999 +TSRA SCT030CB BKN060 18/15 Q1015');
  assert.equal(m.precip, 'storm');
  assert.equal(m.cover, 'BKN');
  assert.equal(m.category, 'VFR');
});

test('METAR: fog with vertical visibility is LIFR overcast', () => {
  const m = parseMetar('FAOR 050400Z 00000KT 0200 FG VV001 08/08 Q1024');
  assert.equal(m.fog, true);
  assert.equal(m.cover, 'OVC');
  assert.equal(m.category, 'LIFR');
});

test('METAR: US statute-mile visibility including mixed fractions', () => {
  assert.equal(parseMetar('KJFK 051251Z 09010KT 1 1/2SM BR OVC005 10/09 A2992').category, 'IFR');
  assert.equal(parseMetar('KJFK 051251Z 09010KT 10SM FEW250 18/09 A3012').category, 'VFR');
  assert.equal(parseMetar('KJFK 051251Z 09010KT 10SM -SN BKN025 M02/M05 A3012').precip, 'snow');
});

test('METAR: trend and remarks are ignored', () => {
  const m = parseMetar('FAOR 051300Z 34012KT 9999 FEW040 22/02 Q1023 TEMPO 3000 TSRA BKN010');
  assert.equal(m.precip, 'none');
  assert.equal(m.cover, 'FEW');
});
