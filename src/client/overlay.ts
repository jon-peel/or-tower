import type { Flight, FlightCategory, OverlayPayload } from '../shared/types.ts';
import { h } from './dom.ts';
import { createSky, type SkyState } from './sky.ts';
import { createFlapRow, type FlapRow } from './splitflap.ts';

const POLL_MS = 15_000;
const STALE_POLL_MS = 60_000; // server unreachable this long → "data delayed"
const STALE_FEED_MS = 120_000; // VATSIM feed timestamp older than this → "data delayed"
const ROWS = 3;
const COLUMNS = [8, 4, 9]; // callsign, other airport, status (fits "ETA 1435Z")

type Overrides = Partial<SkyState> & { category?: FlightCategory };

export function startOverlay(root: HTMLElement, q: URLSearchParams) {
  const callsign = q.get('callsign')!;
  const airport = q.get('airport');
  document.documentElement.classList.add('is-overlay');
  if (q.has('preview')) document.documentElement.classList.add('is-preview');
  const skyOverride = readSkyOverride(q);

  const ui = buildDom();
  root.append(ui.error, ui.bar);

  let data: OverlayPayload | undefined;
  let lastOkAt = Date.now();
  const params = new URLSearchParams({ callsign, ...(airport ? { airport } : {}) });

  async function poll() {
    try {
      const res = await fetch(`/api/overlay?${params}`);
      const body = await res.json();
      if (res.status === 400) {
        ui.error.textContent = body.error;
        return; // bad input won't fix itself; stop polling
      }
      if (!res.ok) throw new Error(body.error);
      data = body as OverlayPayload;
      lastOkAt = Date.now();
      ui.error.textContent = '';
      render(ui, data, skyOverride);
    } catch (err) {
      console.warn('overlay poll failed', err); // keep showing the last good data
    }
    setTimeout(poll, POLL_MS);
  }

  poll();
  setInterval(() => {
    renderClock(ui, data);
    const now = Date.now();
    const feedAge = data ? now - Date.parse(data.updatedAt) : 0;
    ui.stale.hidden = !data || (now - lastOkAt < STALE_POLL_MS && feedAge < STALE_FEED_MS);
  }, 1000);
}

type Ui = ReturnType<typeof buildDom>;

function buildDom() {
  const t = (cls: string) => h(`span.${cls}`, '');
  const ui = {
    clock: t('tab-clock'),
    controller: t('tab-controller'),
    facility: t('pos-facility'),
    freq: t('pos-freq'),
    tag: t('pos-tag'),
    aptName: t('apt-name'),
    aptCodes: t('apt-codes'),
    towerIcao: h('div.paint-icao', ''),
    towerLogo: h('img.paint-logo', { alt: '' }),
    region: h('div.region', ''),
    wx: h('div.wx', ''),
    dep: Array.from({ length: ROWS }, createBoardRow),
    arr: Array.from({ length: ROWS }, createBoardRow),
    error: h('div.error', ''),
    sky: createSky(),
    stale: Object.assign(h('span.tab-stale', 'Data delayed'), { hidden: true }),
    event: Object.assign(h('div.lt-event'), { hidden: true }),
    bar: h('div.lt'),
  };

  const column = (title: string, rows: BoardRow[]) =>
    h('section.board-col', {}, h('h2', title), ...rows.map((r) => r.el));

  ui.bar.append(
    h('div.lt-tab', {}, ui.stale, h('span.tab-brand', 'VATSIM'), ui.controller, ui.clock),
    ui.event,
    h(
      'div.lt-left',
      {},
      ui.sky.el,
      // ICAO and logo are "painted" onto the tower's left and right walls.
      h('div.tower', {}, h('img', { src: '/assets/or-twr.png', alt: '' }), ui.towerIcao, ui.towerLogo),
      h(
        'div.lt-info',
        {},
        h('div.apt', {}, ui.aptName, ui.aptCodes),
        h('div.pos', {}, ui.facility, ui.freq, ui.tag),
        ui.region,
        ui.wx,
      ),
    ),
    h('div.board', {}, column('Departures', ui.dep), column('Arrivals', ui.arr)),
  );
  return ui;
}

function render(ui: Ui, d: OverlayPayload, { category: catOverride, ...skyOverride }: Overrides) {
  const { position: p, airport: a } = d;
  ui.bar.dataset.status = d.status;
  ui.bar.classList.add('is-ready');

  ui.facility.textContent = p.facility;
  ui.freq.textContent = p.frequency ?? '---.---';
  ui.tag.textContent = d.status === 'live' ? 'Live' : 'Standby';

  ui.towerIcao.textContent = a.icao;
  setLogo(ui.towerLogo, a.division, a.region);
  ui.aptName.textContent = a.name;
  ui.aptCodes.textContent = [a.icao, a.iata].filter(Boolean).join(' / ');
  ui.region.textContent = [a.firName && `${a.firName} FIR`, a.country, a.division, a.region].filter(Boolean).join('  ·  ');

  const category = catOverride ?? d.metar?.category;
  const wx = [
    d.atis && `ATIS ${d.atis.code}`,
    d.runways && formatRunways(d.runways),
    d.metar?.wind && `Wind ${d.metar.wind}`,
    d.metar?.qnh,
  ].filter((s): s is string => !!s);
  ui.wx.replaceChildren(
    ...(category ? [h(`span.cat.cat-${category.toLowerCase()}`, category)] : []),
    ...wx.map((s) => h('span', s)),
  );

  ui.sky.set({
    phase: d.sky,
    cover: d.metar?.cover ?? 'CLR',
    precip: d.metar?.precip ?? 'none',
    fog: d.metar?.fog ?? false,
    category,
    ...skyOverride,
  });

  renderEvent(ui.event, d.event);

  fillBoard(ui.dep, d.departures, departureStatus);
  fillBoard(ui.arr, d.arrivals, arrivalStatus);
  renderClock(ui, d);
}

interface BoardRow {
  el: HTMLElement;
  flap: FlapRow;
  tail: HTMLImageElement;
}

/** A board row: airline tail tile + split-flap cells. */
function createBoardRow(): BoardRow {
  const flap = createFlapRow(COLUMNS);
  const tail = h('img', { alt: '' });
  tail.onerror = () => tail.removeAttribute('src'); // no logo for this airline
  return { el: h('div.board-row', {}, h('span.tail', {}, tail), flap.el), flap, tail };
}

/** Swap the tail image with a quick flip, only when the airline changes. */
function setTail(row: BoardRow, airline: string | undefined) {
  const key = airline ?? '';
  if (row.tail.dataset.airline === key) return;
  row.tail.dataset.airline = key;
  const tile = row.tail.parentElement!;
  tile.classList.remove('tick');
  void tile.offsetWidth;
  tile.classList.add('tick');
  if (airline) row.tail.src = `/api/tail/${airline}`;
  else row.tail.removeAttribute('src');
}

function fillBoard(rows: BoardRow[], flights: Flight[], status: (f: Flight) => [string, string]) {
  rows.forEach((row, i) => {
    const f = flights[i];
    setTail(row, f?.airline);
    if (!f) return row.flap.set([]);
    const [text, tone] = status(f);
    row.flap.set([f.callsign, f.other, text], tone);
  });
}

function departureStatus(f: Flight): [string, string] {
  switch (f.status) {
    case 'TAXI': return ['TAXI', 'go'];
    case 'BOARDING': return ['BOARDING', 'hold'];
    case 'DEPARTED': return ['DEPARTED', 'dim'];
    default: return ['FILED', 'dim'];
  }
}

function arrivalStatus(f: Flight): [string, string] {
  if (f.status === 'LANDED') return ['LANDED', 'dim'];
  if (f.status === 'APPROACH') return ['APPROACH', 'go'];
  return [`ETA ${zulu(Date.now() + (f.etaMin ?? 0) * 60_000)}`, 'hold'];
}

/**
 * Logo on the tower's wall, from assets/logos/: the controller's division (e.g. VATSSA.png),
 * else their region (e.g. EMEA.svg), else the VATSIM logo, else hidden.
 * Division/region logos are "painted" on (skewed + blended). The VATSIM logo is shown upright
 * and unaltered (`.is-official`), as VATSIM's brand guidelines forbid distorting or recolouring it.
 */
function setLogo(img: HTMLImageElement, division: string | undefined, region: string | undefined) {
  const key = `${division ?? ''}/${region ?? ''}`;
  if (img.dataset.key === key) return;
  img.dataset.key = key;
  const names = [division, region, 'vatsim'].filter((n): n is string => !!n);
  const candidates = names.flatMap((n) => [`${n}.svg`, `${n}.png`]);
  const tryNext = () => {
    const next = candidates.shift();
    if (!next) return img.removeAttribute('src');
    img.classList.toggle('is-official', next.startsWith('vatsim.'));
    img.src = `/assets/logos/${next}`;
  };
  img.onerror = tryNext;
  tryNext();
}

/** Epoch ms → "1435Z". */
function zulu(ms: number): string {
  return `${new Date(ms).toISOString().slice(11, 16).replace(':', '')}Z`;
}

/** "RWY 03L/03R" when arrivals and departures share runways, else "ARR 03R · DEP 03L". */
function formatRunways({ arr, dep }: { arr: string[]; dep: string[] }): string {
  if (arr.join() === dep.join()) return `RWY ${arr.join('/')}`;
  return [arr.length && `ARR ${arr.join('/')}`, dep.length && `DEP ${dep.join('/')}`].filter(Boolean).join(' · ');
}

/** Event tab above the bar: "EVENT LIVE · name · until 1800Z" or "EVENT 1600–1900Z · name". */
function renderEvent(el: HTMLElement, ev: OverlayPayload['event']) {
  el.hidden = !ev;
  if (!ev) return;
  const hhmm = (iso: string) => zulu(Date.parse(iso));
  el.classList.toggle('is-live', ev.live);
  el.replaceChildren(
    h('span.event-label', ev.live ? 'Event live' : `Event ${hhmm(ev.start)}–${hhmm(ev.end)}`),
    h('span.event-name', ev.name),
    ...(ev.live ? [h('span.event-time', `until ${hhmm(ev.end)}`)] : []),
  );
}

function renderClock(ui: Ui, d: OverlayPayload | undefined) {
  const now = new Date();
  ui.clock.textContent = `${now.toISOString().slice(11, 16)}Z`;
  const p = d?.position;
  if (d?.status === 'live' && p?.logonTime) {
    const mins = Math.max(0, Math.floor((now.getTime() - Date.parse(p.logonTime)) / 60_000));
    const online = `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
    ui.controller.textContent = [p.name, p.rating, `Online ${online}`].filter(Boolean).join('  ·  ');
  } else {
    ui.controller.textContent = '';
  }
}

/** Preview overrides, e.g. ?sky=night&cover=OVC&precip=storm&fog=1&cat=IFR */
function readSkyOverride(q: URLSearchParams): Overrides {
  const o: Overrides = {};
  const sky = q.get('sky');
  const cover = q.get('cover')?.toUpperCase();
  const precip = q.get('precip');
  const cat = q.get('cat')?.toUpperCase();
  if (sky === 'dawn' || sky === 'day' || sky === 'dusk' || sky === 'night') o.phase = sky;
  if (cover === 'CLR' || cover === 'FEW' || cover === 'SCT' || cover === 'BKN' || cover === 'OVC') o.cover = cover;
  if (precip === 'none' || precip === 'rain' || precip === 'snow' || precip === 'storm') o.precip = precip;
  if (q.has('fog')) o.fog = q.get('fog') !== '0';
  if (cat === 'VFR' || cat === 'MVFR' || cat === 'IFR' || cat === 'LIFR') o.category = cat;
  return o;
}
