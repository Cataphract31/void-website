/**
 * Audio.
 *
 * An earlier version was square-wave oscillators and raw white noise, which is
 * the precise recipe for 8-bit — hard transients, no space, no body. This one
 * is built the way sound design actually works:
 *
 *   transient + body + tail, through a shared reverb.
 *
 * Everything runs through a convolution reverb built from a procedurally
 * generated impulse response, so sounds occupy a room rather than firing dry
 * at the listener. Voices are sine and triangle stacks with slight inharmonic
 * detuning — that is what reads as struck metal or glass rather than a beep.
 * Attacks are shaped in milliseconds instead of starting instantaneously,
 * which is most of the difference between "premium" and "cheap".
 *
 * Crucially, a mass shatter does not get louder. It gets *deeper* — more sub,
 * more reverb, darker filtering, fewer bright partials — so a big collapse
 * sounds like distance and mass instead of a louder pop.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbBus: GainNode | null = null;
let muted = false;

const STORAGE_KEY = "zinc.muted";
const VOLUME = 0.8;

/**
 * Impulse response: exponentially decaying noise, slightly different per
 * channel for width, with an early lowpass so the tail is dark rather than
 * hissy.
 */
function buildImpulse(ac: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ac.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ac.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const n = Math.random() * 2 - 1;
      // One-pole lowpass keeps the tail warm.
      lp += (n - lp) * 0.28;
      data[i] = lp * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

export function initAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctor();

    // Master chain: gentle glue compression, then a ceiling so a mass shatter
    // can never clip.
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 26;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;

    const out = ac.createGain();
    out.gain.value = muted ? 0 : VOLUME;

    out.connect(comp);
    comp.connect(ac.destination);

    const conv = ac.createConvolver();
    conv.buffer = buildImpulse(ac, 2.6, 2.4);
    const send = ac.createGain();
    send.gain.value = 1;
    // Tame the reverb's top end so tails stay velvety.
    const damp = ac.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 4200;
    send.connect(damp);
    damp.connect(conv);
    conv.connect(out);

    ctx = ac;
    master = out;
    reverbBus = send;
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
    /* preference simply won't persist */
  }
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : VOLUME, ctx.currentTime, 0.03);
}

export function isMuted(): boolean {
  return muted;
}

/** Routes a voice to dry and reverb paths. */
function connectVoice(node: AudioNode, wet: number): void {
  if (!ctx || !master || !reverbBus) return;
  node.connect(master);
  if (wet > 0) {
    const w = ctx.createGain();
    w.gain.value = wet;
    node.connect(w);
    w.connect(reverbBus);
  }
}

interface PartialOpts {
  freq: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  attack?: number;
  detune?: number;
  wet?: number;
  delay?: number;
  glideTo?: number;
}

/** One shaped partial. Soft attack, exponential tail. */
function partial({
  freq,
  dur,
  gain,
  type = "sine",
  attack = 0.008,
  detune = 0,
  wet = 0.25,
  delay = 0,
  glideTo,
}: PartialOpts): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
  osc.detune.value = detune;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g);
  connectVoice(g, wet);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

interface TextureOpts {
  dur: number;
  gain: number;
  freq: number;
  q?: number;
  type?: BiquadFilterType;
  sweepTo?: number;
  attack?: number;
  wet?: number;
  delay?: number;
}

/** Resonant filtered noise — the material texture, never raw white noise. */
function texture({
  dur,
  gain,
  freq,
  q = 1.2,
  type = "bandpass",
  sweepTo,
  attack = 0.004,
  wet = 0.3,
  delay = 0,
}: TextureOpts): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < frames; i++) {
    const n = Math.random() * 2 - 1;
    lp += (n - lp) * 0.45;
    data[i] = lp;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t0);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t0 + dur);
  filter.Q.value = q;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter);
  filter.connect(g);
  connectVoice(g, wet);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/**
 * Struck-metal bell. Inharmonic ratios rather than a clean harmonic series —
 * real struck objects are inharmonic, and faking that is what stops a tone
 * sounding synthetic.
 */
function bell(root: number, dur: number, gain: number, wet = 0.5, delay = 0): void {
  const ratios = [1, 2.01, 2.99, 4.21, 5.43];
  const levels = [1, 0.5, 0.3, 0.16, 0.09];
  ratios.forEach((r, i) => {
    partial({
      freq: root * r,
      dur: dur * (1 - i * 0.13),
      gain: gain * levels[i]!,
      attack: 0.006 + i * 0.002,
      detune: (i % 2 ? 4 : -4) * (i + 1),
      wet,
      delay,
    });
  });
}

/**
 * The metronome. Deliberately soft and low — it repeats every half second, so
 * anything sharp becomes torture within a minute. Rising risk opens it up
 * slightly rather than making it shriller.
 */
export function sfxTick(hazard: number): void {
  const t = Math.min(1, hazard / 0.13);
  partial({
    freq: 132 + t * 46,
    dur: 0.075,
    gain: 0.05 + t * 0.045,
    type: "sine",
    attack: 0.003,
    wet: 0.18,
  });
  texture({
    dur: 0.03,
    gain: 0.014 + t * 0.02,
    freq: 2400 + t * 900,
    q: 0.9,
    type: "lowpass",
    wet: 0.12,
  });
}

/**
 * Plates shattering. More at once means bigger and deeper, not louder — the
 * body darkens, the sub grows, and more of it goes to the reverb, so a wipe
 * reads as mass and distance.
 */
export function sfxShatter(count: number): void {
  const heft = Math.min(1, count / 9);

  // Transient: the crack itself.
  texture({
    dur: 0.06,
    gain: 0.12 - heft * 0.03,
    freq: 2100 - heft * 700,
    q: 1.6,
    wet: 0.2,
  });

  // Body: darker and longer as more goes at once.
  texture({
    dur: 0.28 + heft * 0.4,
    gain: 0.1 + heft * 0.1,
    freq: 760 - heft * 380,
    sweepTo: 190 - heft * 90,
    q: 1.1,
    wet: 0.35 + heft * 0.4,
    delay: 0.012,
  });

  // Sub: the weight.
  partial({
    freq: 74 - heft * 18,
    glideTo: 34,
    dur: 0.45 + heft * 0.5,
    gain: 0.16 + heft * 0.16,
    type: "sine",
    attack: 0.012,
    wet: 0.2,
  });

  // Crystalline ring-off. Fewer, quieter partials when many break at once —
  // an individual plate rings, an avalanche does not.
  const rings = Math.max(1, 3 - Math.round(heft * 2));
  for (let i = 0; i < rings; i++) {
    partial({
      freq: 1500 + Math.random() * 1900,
      dur: 0.5 + Math.random() * 0.6,
      gain: (0.035 - heft * 0.02) * (1 - i * 0.25),
      type: "triangle",
      attack: 0.004,
      detune: (Math.random() - 0.5) * 26,
      wet: 0.75,
      delay: 0.01 + i * 0.025,
    });
  }
}

/** You got out. A clean, warm two-note bell — the sound of relief. */
export function sfxExtract(): void {
  bell(784, 0.85, 0.15, 0.55);
  bell(1176, 0.7, 0.09, 0.6, 0.075);
}

/** Your plate went. Deep, dark, and final. */
export function sfxYouDied(): void {
  partial({
    freq: 96,
    glideTo: 28,
    dur: 1.3,
    gain: 0.3,
    type: "sine",
    attack: 0.006,
    wet: 0.45,
  });
  texture({
    dur: 0.85,
    gain: 0.16,
    freq: 900,
    sweepTo: 130,
    q: 0.9,
    wet: 0.6,
  });
  partial({
    freq: 148,
    glideTo: 74,
    dur: 0.7,
    gain: 0.1,
    type: "triangle",
    attack: 0.01,
    wet: 0.5,
  });
}

/** The lattice sealing. Low, solid, a door closing. */
export function sfxSeal(): void {
  partial({ freq: 132, glideTo: 58, dur: 0.5, gain: 0.18, type: "sine", attack: 0.012, wet: 0.4 });
  texture({ dur: 0.22, gain: 0.07, freq: 520, sweepTo: 180, q: 1, wet: 0.35 });
}

/** You bonded in. Quiet, affirmative. */
export function sfxJoin(): void {
  bell(523, 0.5, 0.09, 0.4);
}

/**
 * The jackpot. A rising major swell with a sub floor and a long shimmer —
 * the only moment the product is allowed to sound warm.
 */
export function sfxBonanza(): void {
  // Root movement: I - V - octave, each a full inharmonic bell stack.
  bell(392, 2.4, 0.17, 0.7, 0);
  bell(587, 2.2, 0.14, 0.7, 0.16);
  bell(784, 2.6, 0.15, 0.8, 0.32);
  bell(1046, 2.4, 0.1, 0.85, 0.5);

  // Sub floor.
  partial({ freq: 98, dur: 2.8, gain: 0.2, type: "sine", attack: 0.05, wet: 0.4 });
  partial({ freq: 49, dur: 3.2, gain: 0.16, type: "sine", attack: 0.08, wet: 0.3 });

  // Shimmer sweeping upward into the tail.
  texture({
    dur: 2.2,
    gain: 0.05,
    freq: 900,
    sweepTo: 7000,
    q: 0.7,
    wet: 0.9,
    attack: 0.4,
    delay: 0.2,
  });
}
