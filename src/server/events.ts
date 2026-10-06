// VATSIM events (my.vatsim.net), cached for 10 minutes.

import type { EventInfo } from '../shared/types.ts';

const EVENTS_URL = 'https://my.vatsim.net/api/v2/events/latest';
const MAX_AGE_MS = 10 * 60_000;
const SOON_MS = 6 * 3600_000; // show upcoming events starting within 6 hours

export interface VatsimEvent {
  name: string;
  link?: string;
  start_time: string;
  end_time: string;
  airports: { icao: string }[];
}

let cached: { events: VatsimEvent[]; fetchedAt: number } | undefined;
let inflight: Promise<VatsimEvent[]> | undefined;

export async function getEvents(): Promise<VatsimEvent[]> {
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached.events;
  inflight ??= (async () => {
    const res = await fetch(EVENTS_URL, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`events HTTP ${res.status}`);
    const events = ((await res.json()) as { data: VatsimEvent[] }).data;
    cached = { events, fetchedAt: Date.now() };
    return events;
  })().finally(() => (inflight = undefined));
  try {
    return await inflight;
  } catch {
    return cached?.events ?? []; // events are a nice-to-have; never fail the overlay
  }
}

/** The event at this airport that is live now, else the next one starting within 6 hours. */
export function eventFor(events: VatsimEvent[], icao: string, now = Date.now()): EventInfo | undefined {
  const here = events
    .filter((e) => e.airports.some((a) => a.icao === icao))
    .map((e) => ({ e, start: Date.parse(e.start_time), end: Date.parse(e.end_time) }))
    .filter(({ start, end }) => end > now && start < now + SOON_MS)
    .sort((a, b) => a.start - b.start);
  const pick = here.find(({ start }) => start <= now) ?? here[0];
  if (!pick) return undefined;
  return { name: pick.e.name, start: pick.e.start_time, end: pick.e.end_time, live: pick.start <= now };
}
