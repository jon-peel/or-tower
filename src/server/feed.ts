// VATSIM v3 live data feed: fetched at most once per 15s, shared by all requests.

const FEED_URL = 'https://data.vatsim.net/v3/vatsim-data.json';
const MAX_AGE_MS = 15_000;

export interface FlightPlan {
  departure: string;
  arrival: string;
  aircraft_short: string;
  deptime: string;
}

export interface Pilot {
  callsign: string;
  latitude: number;
  longitude: number;
  altitude: number;
  groundspeed: number;
  logon_time: string;
  flight_plan?: FlightPlan | null;
}

export interface Prefile {
  callsign: string;
  flight_plan?: FlightPlan | null;
}

export interface Controller {
  callsign: string;
  name: string;
  frequency: string;
  facility: number;
  rating: number;
  logon_time: string;
}

export interface Atis extends Controller {
  atis_code: string | null;
  text_atis?: string[] | null;
}

export interface VatsimFeed {
  general: { update_timestamp: string };
  pilots: Pilot[];
  controllers: Controller[];
  atis: Atis[];
  prefiles: Prefile[];
  facilities: { id: number; short: string; long: string }[];
  ratings: { id: number; short: string; long: string }[];
}

let cached: { feed: VatsimFeed; fetchedAt: number } | undefined;
let inflight: Promise<VatsimFeed> | undefined;

export async function getFeed(): Promise<VatsimFeed> {
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached.feed;
  inflight ??= fetchFeed().finally(() => (inflight = undefined));
  try {
    return await inflight;
  } catch (err) {
    // Serve stale data rather than blanking the overlay on a transient failure.
    if (cached) return cached.feed;
    throw err;
  }
}

async function fetchFeed(): Promise<VatsimFeed> {
  const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`VATSIM feed HTTP ${res.status}`);
  const feed = (await res.json()) as VatsimFeed;
  cached = { feed, fetchedAt: Date.now() };
  return feed;
}
