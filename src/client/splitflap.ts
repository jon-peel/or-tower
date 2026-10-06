// Split-flap (Solari board) row: fixed-width groups of character cells.
// Changing a cell flips it through a few preceding characters before landing on the target.

import { h } from './dom.ts';

const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-.:';
const STEP_MS = 55;
const STAGGER_MS = 28;

let onFlap: (() => void) | undefined;

/** Called on every flap movement (e.g. to play a clack). */
export function setFlapSound(fn: () => void) {
  onFlap = fn;
}

interface Cell {
  el: HTMLElement;
  char: string;
  run: number;
}

export interface FlapRow {
  el: HTMLElement;
  /** One string per group; padded/truncated to the group width. */
  set(values: string[], tone?: string): void;
  /** Flip the current text in again from blank. */
  replay(): void;
}

export function createFlapRow(widths: number[]): FlapRow {
  const groups = widths.map((w) => Array.from({ length: w }, () => makeCell()));
  const el = h('div.flap-row', {}, ...groups.map((cells) => h('span.flap-group', {}, ...cells.map((c) => c.el))));

  let last: string[] = [];
  return {
    el,
    set(values, tone = '') {
      last = values;
      el.dataset.tone = tone;
      let i = 0;
      groups.forEach((cells, g) => {
        const text = (values[g] ?? '').toUpperCase().padEnd(cells.length).slice(0, cells.length);
        cells.forEach((cell, c) => flipTo(cell, text[c], i++ * STAGGER_MS));
      });
    },
    replay() {
      for (const cell of groups.flat()) cell.char = ' ';
      this.set(last, el.dataset.tone);
    },
  };
}

function makeCell(): Cell {
  const el = h('span.flap', {}, h('span.flap-char', ' '));
  return { el, char: ' ', run: 0 };
}

function flipTo(cell: Cell, target: string, delay: number) {
  if (!CHARS.includes(target)) target = ' ';
  const run = ++cell.run; // cancels any flip still in progress
  if (cell.char === target) return;
  const end = CHARS.indexOf(target);
  // Flip through 3–9 characters leading up to the target, like a real drum.
  const steps = 3 + Math.floor(Math.random() * 7);
  let n = steps;
  const charEl = cell.el.firstElementChild as HTMLElement;

  const tick = () => {
    if (run !== cell.run) return; // superseded by a newer update
    const ch = CHARS[(end - n + CHARS.length * 2) % CHARS.length];
    charEl.textContent = ch;
    cell.char = ch;
    cell.el.classList.remove('tick');
    void cell.el.offsetWidth; // restart the CSS animation
    cell.el.classList.add('tick');
    onFlap?.();
    if (n-- > 0) setTimeout(tick, STEP_MS);
  };
  setTimeout(tick, delay);
}
