// Animated sky behind the info section: colour from the sun's position, weather from the METAR.
// All visuals are CSS (see .sky in styles.css); this only builds the layers and sets data attributes.

import type { CloudCover, FlightCategory, Precip, SkyPhase } from '../shared/types.ts';
import { h } from './dom.ts';

export interface SkyState {
  phase: SkyPhase;
  cover: CloudCover;
  precip: Precip;
  fog: boolean;
  /** Low ceilings / poor visibility (IFR, LIFR) get a lower, darker deck and haze. */
  category?: FlightCategory;
}

const CLOUDS = 16; // CSS shows the first 3 / 6 / 10 / 16 for FEW / SCT / BKN / OVC

export function createSky() {
  const clouds = Array.from({ length: CLOUDS }, (_, i) => {
    // Deterministic spread so the layout doesn't jump between reloads.
    const top = (i * 37) % 70; // % of sky height
    const scale = 0.7 + ((i * 53) % 60) / 100;
    const duration = 70 + ((i * 29) % 60); // seconds to cross
    const cloud = h('div.cloud');
    cloud.style.top = `${top - 15}%`;
    cloud.style.setProperty('--s', String(scale));
    cloud.style.animationDuration = `${duration}s`;
    // Start mid-crossing, spread along the path (golden-ratio steps avoid bunching).
    cloud.style.animationDelay = `${-((0.35 + i * 0.618) % 1) * duration}s`;
    return cloud;
  });

  const el = h(
    'div.sky',
    {},
    h('div.sky-grad'),
    h('div.sky-stars'),
    h('div.sky-sun'),
    h('div.sky-deck'),
    h('div.sky-clouds', {}, ...clouds),
    h('div.sky-haze'),
    h('div.sky-precip'),
    h('div.sky-fog'),
    h('div.sky-flash'),
    h('div.sky-scrim'),
  );

  return {
    el,
    set(s: SkyState) {
      el.dataset.phase = s.phase;
      el.dataset.cover = s.cover;
      el.dataset.precip = s.precip;
      el.dataset.fog = String(s.fog);
      el.dataset.cat = s.category ?? '';
    },
  };
}
