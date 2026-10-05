// VATSIM's API lists divisions but doesn't map airports to them, so this is a
// best-effort lookup by ICAO prefix. Two-letter entries override one-letter ones.

interface Division {
  code: string;
  region: string;
}

const DIV: Record<string, Division> = {
  SSA: { code: 'VATSSA', region: 'EMEA' },
  MENA: { code: 'VATMENA', region: 'EMEA' },
  EUD: { code: 'VATEUD', region: 'EMEA' },
  GBR: { code: 'VATUK', region: 'EMEA' },
  IL: { code: 'VATIL', region: 'EMEA' },
  RUS: { code: 'VATRUS', region: 'EMEA' },
  USA: { code: 'VATUSA', region: 'AMAS' },
  CAN: { code: 'VATCAN', region: 'AMAS' },
  MCO: { code: 'VATMEX', region: 'AMAS' },
  CAM: { code: 'VATCAM', region: 'AMAS' },
  CAR: { code: 'VATCAR', region: 'AMAS' },
  SAM: { code: 'VATSAM', region: 'AMAS' },
  BRZ: { code: 'VATBRZ', region: 'AMAS' },
  PAC: { code: 'VATPAC', region: 'APAC' },
  NZ: { code: 'VATNZ', region: 'APAC' },
  SEA: { code: 'VATSEA', region: 'APAC' },
  PRC: { code: 'VATPRC', region: 'APAC' },
  ROC: { code: 'VATROC', region: 'APAC' },
  JPN: { code: 'VATJPN', region: 'APAC' },
  KOR: { code: 'VATKOR', region: 'APAC' },
  WA: { code: 'VATWA', region: 'APAC' },
};

const BY_PREFIX: Record<string, keyof typeof DIV> = {
  A: 'PAC', B: 'EUD', C: 'CAN', D: 'SSA', E: 'EUD', F: 'SSA', G: 'SSA', H: 'SSA', K: 'USA', L: 'EUD',
  M: 'CAR', N: 'PAC', O: 'MENA', P: 'USA', R: 'SEA', S: 'SAM', T: 'CAR', U: 'RUS', V: 'WA', W: 'SEA', Y: 'PAC', Z: 'PRC',
  DA: 'MENA', DT: 'MENA', GM: 'MENA', GC: 'EUD', HE: 'MENA', HL: 'MENA',
  EG: 'GBR', LL: 'IL', UK: 'EUD',
  MM: 'MCO', MG: 'CAM', MH: 'CAM', MN: 'CAM', MR: 'CAM', MS: 'CAM', MZ: 'CAM', MP: 'CAM',
  NZ: 'NZ', OA: 'WA', OP: 'WA',
  RJ: 'JPN', RO: 'JPN', RK: 'KOR', RC: 'ROC', VH: 'PRC', VM: 'PRC',
  SB: 'BRZ', SD: 'BRZ', SN: 'BRZ', SS: 'BRZ', SW: 'BRZ',
  VT: 'SEA', VV: 'SEA', VL: 'SEA', VD: 'SEA', VY: 'SEA',
};

export function divisionFor(icao: string): Division | undefined {
  const key = BY_PREFIX[icao.slice(0, 2)] ?? BY_PREFIX[icao[0]];
  return key ? DIV[key] : undefined;
}

/** VATSpy has IATA codes for only some airports; fill the gaps we care about. */
export const IATA_OVERRIDES: Record<string, string> = {
  FAOR: 'JNB', FACT: 'CPT', FALE: 'DUR', FAGG: 'GRJ', FABL: 'BFN', FAPE: 'PLZ',
  FAEL: 'ELS', FAKN: 'MQP', FALA: 'HLA', FAGC: 'GCJ', FAUP: 'UTN', FAKM: 'KIM',
};
