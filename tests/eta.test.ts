import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEtaTracker, ETA_THRESHOLD_MIN } from '../src/client/eta.ts';
import type { Flight } from '../src/shared/types.ts';

const T0 = Date.parse('2026-10-05T14:00:00Z');
const MIN = 60_000;
const arr = (callsign: string, etaMin: number, status: Flight['status'] = 'ENROUTE'): Flight => ({
  callsign,
  other: 'FACT',
  aircraft: 'B738',
  status,
  etaMin,
});

test('ETA holds steady while the estimate wobbles under the threshold', () => {
  const etas = createEtaTracker();
  const first = etas.update([arr('SAA335', 30)], T0).get('SAA335');
  assert.equal(first, T0 + 30 * MIN);
  // Each 15 s poll the estimate drifts by a minute or two either way.
  for (const [dt, eta] of [[0.25, 31.5], [0.5, 28], [0.75, 31], [1, 29]] as const) {
    assert.equal(etas.update([arr('SAA335', eta)], T0 + dt * MIN).get('SAA335'), first);
  }
});

test('ETA updates once it drifts by the threshold or more', () => {
  const etas = createEtaTracker();
  etas.update([arr('SAA335', 30)], T0);
  const later = etas.update([arr('SAA335', 30 + ETA_THRESHOLD_MIN)], T0).get('SAA335');
  assert.equal(later, T0 + (30 + ETA_THRESHOLD_MIN) * MIN);
  const jump = etas.update([arr('SAA335', 10)], T0).get('SAA335');
  assert.equal(jump, T0 + 10 * MIN);
});

test('ETA is in whole minutes and new flights show their own estimate straight away', () => {
  const etas = createEtaTracker();
  etas.update([arr('SAA335', 30)], T0);
  const shown = etas.update([arr('SAA335', 31), arr('BAW55', 12)], T0 + 20_000);
  assert.equal(shown.get('SAA335'), T0 + 30 * MIN);
  assert.equal(shown.get('BAW55'), T0 + 12 * MIN);
});

test('flights that leave enroute are forgotten, so a later ETA starts fresh', () => {
  const etas = createEtaTracker();
  etas.update([arr('SAA335', 30)], T0);
  const approach = etas.update([arr('SAA335', 5, 'APPROACH')], T0);
  assert.equal(approach.has('SAA335'), false);
  // Back to enroute (e.g. a go-around): a small change is still shown, nothing stale is held.
  assert.equal(etas.update([arr('SAA335', 29)], T0).get('SAA335'), T0 + 29 * MIN);
});
