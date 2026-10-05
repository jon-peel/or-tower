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
| `preview`   | Grey backdrop for checking the layout in a normal browser.      |
| `sky`, `cover`, `precip`, `fog`, `cat` | Preview the weather background: e.g. `&sky=night&cover=OVC&precip=storm&fog=1&cat=IFR`. Values: `sky` dawn/day/dusk/night, `cover` CLR/FEW/SCT/BKN/OVC, `precip` none/rain/snow/storm, `cat` VFR/MVFR/IFR/LIFR. |

In OBS: **Sources → + → Browser**, paste the URL, width 1920, height 1080.

## Data

- Live feed: `data.vatsim.net/v3/vatsim-data.json` (cached 15 s)
- Airports / FIRs / countries: VATSpy data project (cached in `data/`, refreshed weekly)
- METAR: `metar.vatsim.net` (cached 5 min)
- Division: best-effort ICAO prefix table in `src/server/divisions.ts`
- Sky: day/dawn/dusk/night from the sun's elevation at the airport (`src/server/sun.ts`); clouds, rain/snow/storm, fog and VFR/IFR category from the METAR (`src/server/metar.ts`)

VATSIM has no schedules, so board status and arrival ETAs are inferred from
position and ground speed (`src/server/traffic.ts`).
