# OR Tower overlay

Localhost OBS overlay for streaming VATSIM tower controlling: a lower third with
position / airport / weather info and a split-flap departures & arrivals board.

## Run

Requires Node 24+.

```sh
npm install
npm start          # builds the overlay, serves http://localhost:3000
npm run dev        # rebuild + restart on change
npm test
```

Open http://localhost:3000/ for the setup form, or go straight to
`http://localhost:3000/?callsign=FAOR_TWR`.

| Query       | Meaning                                                        |
|-------------|----------------------------------------------------------------|
| `callsign`  | Position callsign (required). Airport is taken from its prefix. |
| `airport`   | ICAO override when the prefix isn't the airport.                |
| `sky`, `cover`, `precip`, `fog`, `cat` | Preview the weather background: e.g. `&sky=night&cover=OVC&precip=storm&fog=1&cat=IFR`. Values: `sky` dawn/day/dusk/night, `cover` CLR/FEW/SCT/BKN/OVC, `precip` none/rain/snow/storm, `cat` VFR/MVFR/IFR/LIFR. |

In OBS: **Sources → + → Browser**, paste the URL, width 1920, height 1080.

## Sound

The board plays a split-flap clack when it changes. In OBS, tick **Control audio via OBS** on the
Browser Source so it appears in the Audio Mixer (turn it down or mute it there). A normal browser
tab blocks sound until the page is clicked, so it shows a "Click to enable flap sound" button;
OBS doesn't need it.

## Logo

The ICAO code is painted on the tower's right wall; a logo goes on the left wall. The logo is
picked from `assets/logos/` (SVG or PNG, transparent background, roughly square to 3:2):

1. the controller's division, named by the code shown in the lower third, e.g. `VATSSA.png`
2. their region, e.g. `EMEA.svg`
3. `vatsim.svg` — the official VATSIM logo
4. otherwise no logo

Division/region logos are "painted" on (skewed to the wall and blended into it). The VATSIM
logo is shown upright and unaltered, because the [VATSIM brand guidelines](https://cdn.vatsim.net/VATSIM_Brand_Guidelines_v2.pdf)
forbid distorting or recolouring it.

Included: `vatsim.svg` from the official [VATSIM logo pack](https://vats.im/logo) (no-tagline
version), and `VATSSA.png`, the roundel from VATSSA's own site
([VATSIM-SSA/ssa-homepage](https://github.com/VATSIM-SSA/ssa-homepage), `public/assets/favicon.png`).

## Hosted (Netlify)

Live at **https://twr.jonathanpeel.co.za** — use e.g.
`https://twr.jonathanpeel.co.za/?callsign=FAOR_TWR` as the OBS Browser Source, no local
server needed. Every push to `main` builds and deploys automatically.

- `netlify.toml`: build command `npm run build:site` (bundles the client and assembles `site/`)
- `netlify/functions/overlay.mts` → `/api/overlay`, `netlify/functions/tail.mts` → `/api/tail/:code`
  (thin wrappers around the same `src/server` code the local server uses)
- Netlify's edge caches overlay data ~10 s per position and airline logos for a week
- Try the Netlify build locally: `npx netlify-cli build --offline && npx netlify-cli serve`

## Airline tails

Each board row shows the airline's tail/emblem, keyed by the ICAO airline code in the
callsign (`SAA335` → `SAA`; registrations like `ZSABC` get none). Images are looked up in:

1. `assets/airlines/<CODE>.svg` or `.png` — your own, always wins
2. `data/tails/` — cache of earlier downloads
3. the community set [Jxck-S/airline-logos](https://github.com/Jxck-S/airline-logos)
   (`flightaware_logos/`), fetched once per airline and cached; airlines without a logo
   are re-checked weekly

The community logos are airline trademarks collected from FlightAware; the repo carries no
licence. They are downloaded on demand and never committed here.

## Data

- Live feed: `data.vatsim.net/v3/vatsim-data.json` (cached 15 s)
- Airports / FIRs / countries: VATSpy data project (cached in `data/`, refreshed weekly)
- METAR: `metar.vatsim.net` (cached 5 min)
- Division: best-effort ICAO prefix table in `src/server/divisions.ts`
- Runway in use: best-effort parse of the ATIS text (`src/server/runways.ts`); split arrival/departure ATIS supported
- Events: `my.vatsim.net/api/v2/events/latest` (cached 10 min) — a tab above the bar shows an event at the airport that is live, or starting within 6 hours
- If the server or VATSIM feed stops updating for a minute or two, the clock tab shows **DATA DELAYED**
- Sky: day/dawn/dusk/night from the sun's elevation at the airport (`src/server/sun.ts`); clouds, rain/snow/storm, fog and VFR/IFR category from the METAR (`src/server/metar.ts`)

VATSIM has no schedules, so board status and arrival ETAs are inferred from
position and ground speed (`src/server/traffic.ts`).
