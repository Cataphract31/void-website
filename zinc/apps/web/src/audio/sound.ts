/**
 * Procedural audio. No sample files — every sound is synthesised, so the
 * bundle stays small and nothing has to be licensed.
 *
 * Browsers refuse to start an AudioContext before a user gesture, so the
 * context is created lazily on the first interaction and every call before
 * that is a silent no-op.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

const STORAGE_KEY = "zinc.muted";

export function initAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  try {
    const Ctor = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function loadMutePreference(): boolean {
  try {
    muted = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    muted = false;
  }
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* storage unavailable; preference just won't persist */
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(next ? 0 : 0.9, ctx.currentTime, 0.02);
  }
}

export function isMuted(): boolean {
  return muted;
}

interface ToneOpts {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, to, dur, type = "sine", gain = 0.2, delay = 0 }: ToneOpts): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Filtered noise burst — the fracture texture. */
function noise(dur: number, gain: number, freq: number, delay = 0): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.25), t0 + dur);
  filter.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

/** The metronome under the whole round. Sharpens as risk climbs. */
export function sfxTick(hazard: number): void {
  const t = Math.min(1, hazard / 0.13);
  tone({
    freq: 1750 + t * 900,
    dur: 0.028,
    type: "square",
    gain: 0.016 + t * 0.03,
  });
}

/** Plates shattering. Scales with how many went at once. */
export function sfxShatter(count: number): void {
  const heft = Math.min(1, count / 8);
  noise(0.16 + heft * 0.22, 0.16 + heft * 0.26, 2600 - heft * 900);
  tone({ freq: 220 - heft * 60, to: 48, dur: 0.26 + heft * 0.2, type: "sawtooth", gain: 0.1 + heft * 0.14 });
  if (count >= 5) {
    tone({ freq: 90, to: 34, dur: 0.5, type: "sine", gain: 0.22, delay: 0.02 });
  }
}

/** You got out. Clean rising interval. */
export function sfxExtract(): void {
  tone({ freq: 620, to: 1180, dur: 0.13, type: "triangle", gain: 0.18 });
  tone({ freq: 930, to: 1560, dur: 0.16, type: "sine", gain: 0.12, delay: 0.05 });
}

/** Your plate went. Heavy and final. */
export function sfxYouDied(): void {
  noise(0.4, 0.3, 1700);
  tone({ freq: 150, to: 32, dur: 0.62, type: "sawtooth", gain: 0.26 });
}

export function sfxSeal(): void {
  tone({ freq: 180, to: 78, dur: 0.34, type: "sine", gain: 0.2 });
  noise(0.16, 0.1, 700);
}

export function sfxJoin(): void {
  tone({ freq: 440, to: 660, dur: 0.1, type: "triangle", gain: 0.14 });
}

/** The jackpot. Deliberately the loudest, longest thing in the product. */
export function sfxBonanza(): void {
  const notes = [523, 659, 784, 1046, 1318, 1568, 2093];
  notes.forEach((n, i) => {
    tone({ freq: n, to: n * 1.5, dur: 0.6, type: "triangle", gain: 0.2, delay: i * 0.085 });
    tone({ freq: n / 2, dur: 0.5, type: "sine", gain: 0.12, delay: i * 0.085 });
  });
  tone({ freq: 60, to: 40, dur: 1.4, type: "sine", gain: 0.3 });
  noise(1.0, 0.14, 5200, 0.1);
}
