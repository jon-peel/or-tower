// Holds each arrival's displayed ETA steady. VATSIM ETAs are re-estimated from position and
// ground speed on every poll, so they wobble by a minute or two; re-flapping the board for that
// is just noise. A shown ETA only moves once the estimate has drifted by ETA_THRESHOLD_MIN.

import type { Flight } from '../shared/types.ts';

export const ETA_THRESHOLD_MIN = 3;

export interface EtaTracker {
  /** Epoch ms ETA to display per enroute callsign; forgets flights no longer enroute. */
  update(arrivals: Flight[], now: number): Map<string, number>;
}

export function createEtaTracker(thresholdMin = ETA_THRESHOLD_MIN): EtaTracker {
  let shown = new Map<string, number>();
  return {
    update(arrivals, now) {
      const next = new Map<string, number>();
      for (const f of arrivals) {
        if (f.status !== 'ENROUTE') continue;
        // Whole minutes, so the comparison matches what the board shows.
        const eta = Math.round((now + (f.etaMin ?? 0) * 60_000) / 60_000) * 60_000;
        const prev = shown.get(f.callsign);
        next.set(f.callsign, prev !== undefined && Math.abs(eta - prev) < thresholdMin * 60_000 ? prev : eta);
      }
      shown = next;
      return next;
    },
  };
}
