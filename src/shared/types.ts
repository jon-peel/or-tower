// Shapes shared between the server (/api/overlay) and the overlay client.

export type DepartureStatus = 'TAXI' | 'BOARDING' | 'DEPARTED' | 'SCHED';
export type ArrivalStatus = 'APPROACH' | 'ENROUTE' | 'LANDED';

export interface Flight {
  callsign: string;
  /** ICAO airline code from the callsign (SAA335 → SAA), for the tail logo. */
  airline?: string;
  /** Destination ICAO for departures, origin ICAO for arrivals. */
  other: string;
  aircraft: string;
  status: DepartureStatus | ArrivalStatus;
  /** Minutes to touchdown (arrivals that are airborne only). */
  etaMin?: number;
}

export interface PositionInfo {
  callsign: string;
  facility: string;
  frequency?: string;
  name?: string;
  rating?: string;
  logonTime?: string;
}

export interface AirportInfo {
  icao: string;
  iata?: string;
  name: string;
  firName?: string;
  country?: string;
  division?: string;
  region?: string;
}

export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
export type CloudCover = 'CLR' | 'FEW' | 'SCT' | 'BKN' | 'OVC';
export type Precip = 'none' | 'rain' | 'snow' | 'storm';

export interface MetarInfo {
  raw: string;
  wind?: string;
  qnh?: string;
  category?: FlightCategory;
  cover: CloudCover;
  precip: Precip;
  fog: boolean;
}

export interface EventInfo {
  name: string;
  start: string;
  end: string;
  live: boolean;
}

export interface OverlayPayload {
  status: 'live' | 'standby';
  position: PositionInfo;
  airport: AirportInfo;
  sky: SkyPhase;
  atis?: { code: string };
  /** Best-effort from the ATIS text. */
  runways?: { arr: string[]; dep: string[] };
  event?: EventInfo;
  metar?: MetarInfo;
  departures: Flight[];
  arrivals: Flight[];
  updatedAt: string;
}
