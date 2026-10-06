// Split-flap "clack", synthesised with Web Audio (no audio files): a few ms of noise through a
// band-pass filter with a fast decay, slightly varied each time so a rattle doesn't sound robotic.
// Off unless the overlay URL has ?sound=1. In OBS, tick "Control audio via OBS" on the Browser
// Source to route it to the stream mixer.

const MIN_GAP_MS = 14; // cap: a full-board update becomes a rattle, not a wall of noise

export interface Clacker {
  click(): void;
  /** False while the browser blocks audio until the user clicks (never in OBS). */
  running(): boolean;
  resume(): Promise<void>;
  /** Called whenever the audio state changes (e.g. blocked → running). */
  onChange(fn: () => void): void;
}

export function createClacker(volume: number): Clacker {
  const ctx = new AudioContext();
  const noise = noiseBuffer(ctx, 0.04);
  let last = -Infinity;

  const click = () => {
    if (ctx.state !== 'running') return;
    const now = performance.now();
    if (now - last < MIN_GAP_MS) return;
    last = now;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800 + Math.random() * 1600;
    band.Q.value = 1.4;

    const gain = ctx.createGain();
    const peak = volume * (0.55 + Math.random() * 0.45);
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

    src.connect(band).connect(gain).connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.04);
  };

  return {
    click,
    running: () => ctx.state === 'running',
    resume: () => ctx.resume(),
    onChange: (fn) => ctx.addEventListener('statechange', fn),
  };
}

/** White noise with a sharp attack, shaped like a flap hitting its stop. */
function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.exp(-i / (ctx.sampleRate * 0.006));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buf;
}
