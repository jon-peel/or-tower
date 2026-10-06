// Best-effort "runway in use" from free-text ATIS. Phrasing varies wildly between controllers,
// so this looks for runway designators right after RWY/RUNWAY, skips warnings/NOTAMs about
// closed or out-of-service runways, and sorts runways into arrival/departure by nearby words
// (or by an _A_ / _D_ ATIS callsign).

export interface RunwaysInUse {
  arr: string[];
  dep: string[];
}

const DIGITS: Record<string, string> = {
  ZERO: '0', ONE: '1', TWO: '2', THREE: '3', FOUR: '4', FIVE: '5', SIX: '6', SEVEN: '7', EIGHT: '8', NINE: '9', NINER: '9',
};
const SIDE: Record<string, string> = { LEFT: 'L', RIGHT: 'R', CENTER: 'C', CENTRE: 'C' };

const RUNWAY_WORD = /^(RWY|RWYS|RUNWAY|RUNWAYS)$/;
const IDENT = /^(0?[1-9]|[12]\d|3[0-6])[LRC]?$/;
const CONNECTOR = /^(AND|OR|&|,|\/|IN|USE|FOR)$/;
const ARR_WORDS = /^(LDG|LANDING|ARR|ARRS|ARRIVALS?|APCH|APCHS|APP|APPS|APPR|APPROACH|APPROACHES|ILS|ILS-\w+|VIS|VISUAL|RNAV|RNP|LOC|EXP|EXPECT|EXPECTED)$/;
const DEP_WORDS = /^(DEP|DEPS|DEPG|DEPTG|DEPARTING|DEPARTURES?|TAKEOFF|T\/O|TKOF)$/;
const SKIP_BEFORE = /^(MISTAKE|VACATING|VACATE|CROSS|CROSSING|AFTER|HOLD|CONDITION|WIND|OPPOSITE)/;
const SKIP_AFTER = /^(CLSD|CLOSED|CLO|OTS|U\/S|CONDITION|WIP|REQUEST|REQ|TOUCHDOWN)/;

type Role = 'arr' | 'dep' | 'both';

export function runwaysInUse(atis: { callsign: string; text_atis?: string[] | null }[]): RunwaysInUse | undefined {
  const arr = new Map<string, string>();
  const dep = new Map<string, string>();

  for (const a of atis) {
    const kind: Role = /_A_ATIS$/.test(a.callsign) ? 'arr' : /_D_ATIS$/.test(a.callsign) ? 'dep' : 'both';
    const tokens = tokenize((a.text_atis ?? []).join(' '));

    for (let i = 0; i < tokens.length; i++) {
      if (/^NOTAMS?$/.test(tokens[i])) break; // the rest of the ATIS is notices (closures etc.)
      if (!RUNWAY_WORD.test(tokens[i])) continue;

      // Context before the keyword, back to the previous sentence break.
      const before: string[] = [];
      for (let j = i - 1; j >= 0 && before.length < 6 && tokens[j] !== '.'; j--) before.push(tokens[j]);
      if (before.some((t) => SKIP_BEFORE.test(t))) continue;
      const preArr = before.some((t) => ARR_WORDS.test(t));
      const preDep = before.some((t) => DEP_WORDS.test(t));
      let role: Role = preArr && preDep ? 'both' : preArr ? 'arr' : preDep ? 'dep' : kind;

      // Designators after the keyword, each tagged with the role named most recently
      // ("RWY IN USE FOR ARR 06L AND FOR DEP 06R"). Tolerates "RUNWAY. 26L".
      const found: [string, Role][] = [];
      let j = i + 1;
      for (; j < tokens.length; j++) {
        const t = tokens[j];
        if (IDENT.test(t)) found.push([t, role]);
        else if (ARR_WORDS.test(t)) role = 'arr';
        else if (DEP_WORDS.test(t)) role = 'dep';
        else if (CONNECTOR.test(t)) continue;
        else if (t === '.' && found.length === 0 && j === i + 1) continue;
        else break;
      }
      if (!found.length) continue;

      // "... CLOSED", "... ON REQUEST", "... CONDITION REPORT" right after: not in use.
      const after: string[] = [];
      for (let k = j; k < tokens.length && after.length < 3 && tokens[k] !== '.' && !RUNWAY_WORD.test(tokens[k]); k++) {
        after.push(tokens[k]);
      }
      if (after.some((t) => SKIP_AFTER.test(t))) continue;

      for (const [id, r] of found) {
        const key = runwayKey(id);
        if (r !== 'dep' && !arr.has(key)) arr.set(key, id);
        if (r !== 'arr' && !dep.has(key)) dep.set(key, id);
      }
    }
  }

  if (!arr.size && !dep.size) return undefined;
  // A single ATIS that only names approach (or only departure) runways almost always uses the
  // same ones for the other direction; split _A_/_D_ ATIS say so explicitly, so don't guess there.
  const split = atis.some((a) => /_[AD]_ATIS$/.test(a.callsign));
  const arrList = [...arr.values()];
  const depList = [...dep.values()];
  return {
    arr: (arrList.length || split ? arrList : depList).slice(0, 3),
    dep: (depList.length || split ? depList : arrList).slice(0, 3),
  };
}

/** "8" and "08", "17 LEFT" and "17L" are the same runway. */
function runwayKey(id: string): string {
  const m = /^(\d+)([LRC]?)$/.exec(id)!;
  return `${Number(m[1])}${m[2]}`;
}

/** Uppercase tokens; spelled-out runway numbers and LEFT/RIGHT folded into designators. */
function tokenize(text: string): string[] {
  const raw = text
    .toUpperCase()
    .replace(/\.{2,}/g, ' . ')
    .replace(/([.,])(\s|$)/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t !== ',');

  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    // "TWO SIX LEFT" → "26L"; "ZERO THREE" → "03"
    if (DIGITS[t] && DIGITS[raw[i + 1]]) {
      let id = DIGITS[t] + DIGITS[raw[i + 1]];
      i++;
      if (SIDE[raw[i + 1]]) id += SIDE[raw[++i]];
      out.push(id);
      continue;
    }
    // "24 LEFT" → "24L"
    if (/^\d{1,2}$/.test(t) && SIDE[raw[i + 1]]) {
      out.push(t + SIDE[raw[++i]]);
      continue;
    }
    out.push(t);
  }
  return out;
}
