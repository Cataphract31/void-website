/**
 * Audio.
 *
 * Two rules came out of playtesting, and they drive everything here.
 *
 * 1. NO TONES. Bells, chimes and pitched "blings" are what made the last pass
 *    feel like a toy. Nothing in this file plays a melody or a chord you could
 *    hum, with the single exception of the jackpot, which earns it. Everything
 *    else is material: noise driven through resonant filters, plus sub. That
 *    is how real impact design works — you are meant to hear an object, not a
 *    synthesiser.
 *
 * 2. A MASS SHATTER IS MANY THINGS, NOT ONE BIG THING. Making a wipe louder
 *    sounded like a machine gun; making it deeper sounded like a bad movie
 *    trailer. Twenty plates going at once is a rockfall — a spread of small
 *    cracks, staggered by a few milliseconds each, over one shared low body.
 *    So `sfxShatter` scales in *density*, holding pitch and level roughly
 *    fixed.
 *
 * Everything runs through a convolution reverb built from a generated impulse
 * response, so sounds sit in a room instead of firing dry at the listener.
 *
 * ── Using real recorded samples instead ──────────────────────────────────
 * Synthesis is the fallback, not the ceiling. Drop audio files into
 * `apps/web/public/sfx/` and they are used automatically in place of the
 * synthesised voice, no code change:
 *
 *     tick.mp3  shatter.mp3  shatter_many.mp3  extract.mp3
 *     died.mp3  seal.mp3     join.mp3          bonanza.mp3
 *
 * (.mp3, .wav or .ogg — the loader tries each.) Anything missing keeps its
 * synthesised version, so the pack can be filled in one sound at a time.
 * Sources that are free for commercial use: freesound.org filtered to CC0,
 * or a paid pack from Soundly / A Sound Effect / Krotos.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbBus: GainNode | null = null;
let muted = false;

const STORAGE_KEY = "zinc.muted";
const VOLUME = 0.8;

/* ── Optional sample pack ───────────────────────────────────────────────── */

const SAMPLE_NAMES = [
  "tick",
  "shatter",
  "shatter_many",
  "extract",
  "died",
  "seal",
  "join",
  "bonanza",
] as const;
type SampleName = (typeof SAMPLE_NAMES)[number];

const samples = new Map<SampleName, AudioBuffer>();

/**
 * Tries each container for each name. A miss is completely normal — the file
 * simply isn't in the pack — so failures are silent and leave the synthesised
 * voice in place.
 */
async function loadSamplePack(ac: AudioContext): Promise<void> {
  const base = import.meta.env.BASE_URL || "/";
  await Promise.all(
    SAMPLE_NAMES.map(async (name) => {
      for (const ext of ["mp3", "wav", "ogg"]) {
        try {
          const res = await fetch(`${base}sfx/${name}.${ext}`);
          if (!res.ok) continue;
          const bytes = await res.arrayBuffer();
          // A static host that falls back to index.html will hand us HTML with
          // a 200, so decoding is the real test of whether a sample exists.
          if (bytes.byteLength < 512) continue;
          samples.set(name, await ac.decodeAudioData(bytes));
          return;
        } catch {
          /* next extension */
        }
      }
    }),
  );
}

/** Plays a pack sample if one was found. Returns false to fall through to synthesis. */
function sample(name: SampleName, gain = 1, wet = 0.25, rate = 1): boolean {
  const buf = samples.get(name);
  if (!buf || !ctx || !master || muted) return false;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  connectVoice(g, wet);
  src.start();
  return true;
}

/* ── Engine ─────────────────────────────────────────────────────────────── */

/**
 * Impulse response: exponentially decaying noise, slightly different per
 * channel for width, one-pole lowpassed so the tail is dark rather than hissy.
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

    // Glue compression, then a ceiling so a mass shatter can never clip.
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
    const damp = ac.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 4200;
    send.connect(damp);
    damp.connect(conv);
    conv.connect(out);

    ctx = ac;
    master = out;
    reverbBus = send;

    void loadSamplePack(ac);
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

/** Routes a voice to the dry output and, optionally, the reverb send. */
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

interface SubOpts {
  freq: number;
  dur: number;
  gain: number;
  attack?: number;
  wet?: number;
  delay?: number;
  glideTo?: number;
}

/**
 * Sub-bass weight. Sine only, and kept below ~200Hz — the moment this reaches
 * into the midrange it stops being felt and starts being a note.
 */
function sub({
  freq,
  dur,
  gain,
  attack = 0.008,
  wet = 0.2,
  delay = 0,
  glideTo,
}: SubOpts): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(18, glideTo), t0 + dur);

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

/** Resonant filtered noise. The material itself — never raw white noise. */
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

/** One dry, woody knock. Short enough to read as an impact, not a pitch. */
function knock(freq: number, gain: number, wet = 0.18, delay = 0): void {
  texture({ dur: 0.045, gain, freq, q: 2.4, wet, delay });
  sub({ freq, glideTo: freq * 0.55, dur: 0.1, gain: gain * 0.8, attack: 0.002, wet, delay });
}

/* ── Cues ───────────────────────────────────────────────────────────────── */

/**
 * The metronome. It fires every half second, so it has to be almost
 * subliminal — anything with an edge becomes torture inside a minute. Rising
 * risk firms it up rather than raising its pitch.
 */
export function sfxTick(hazard: number): void {
  const t = Math.min(1, hazard / 0.13);
  if (sample("tick", 0.5 + t * 0.3, 0.12)) return;
  texture({
    dur: 0.032,
    gain: 0.05 + t * 0.05,
    freq: 380 + t * 190,
    q: 1.8,
    wet: 0.14,
  });
  sub({ freq: 96, dur: 0.07, gain: 0.05 + t * 0.03, attack: 0.002, wet: 0.1 });
}

/**
 * Plates shattering — a rockfall, not an explosion.
 *
 * The count changes how *many* cracks you hear and how far they smear across
 * time, not how loud or how low the whole thing is. Pitch and level are held
 * near constant on purpose: one plate and fifteen plates should sound like the
 * same material, in the same room, at different scales of event.
 */
export function sfxShatter(count: number): void {
  const n = Math.max(1, Math.min(7, Math.round(Math.sqrt(count) * 1.6)));
  if (sample(count > 3 ? "shatter_many" : "shatter", 0.85, 0.3)) return;

  // The grains. Each is a separate small fracture, jittered so they never line
  // up into a single machine-gun transient.
  for (let i = 0; i < n; i++) {
    const delay = i === 0 ? 0 : 0.012 + Math.random() * 0.1;
    const f = 900 + Math.random() * 1500;
    texture({
      dur: 0.035 + Math.random() * 0.05,
      // Later grains sit further back, so the cascade has depth.
      gain: (0.075 / (1 + i * 0.45)) * (0.8 + Math.random() * 0.4),
      freq: f,
      q: 2.2,
      sweepTo: f * 0.45,
      wet: 0.25 + i * 0.06,
      delay,
    });
  }

  // One shared body under the whole cascade. Grows sub-linearly, and never
  // drops in pitch with size — mass reads as spread, not as depth.
  const heft = Math.min(1, count / 10);
  texture({
    dur: 0.2 + heft * 0.22,
    gain: 0.07 + heft * 0.045,
    freq: 420,
    sweepTo: 150,
    q: 0.9,
    wet: 0.32 + heft * 0.2,
    delay: 0.01,
  });
  sub({
    freq: 68,
    glideTo: 40,
    dur: 0.3 + heft * 0.22,
    gain: 0.13 + heft * 0.07,
    attack: 0.01,
    wet: 0.18,
  });
}

/**
 * You got out. A pressure release, not a reward jingle — air escaping a seal,
 * settling onto a soft floor. Relief reads better than congratulation, and it
 * does not get grating on the two-hundredth time.
 */
export function sfxExtract(): void {
  if (sample("extract", 0.9, 0.4)) return;
  // Air venting.
  texture({
    dur: 0.34,
    gain: 0.075,
    freq: 2600,
    sweepTo: 620,
    q: 0.7,
    type: "lowpass",
    attack: 0.012,
    wet: 0.45,
  });
  // The floor it lands on.
  sub({ freq: 116, glideTo: 88, dur: 0.5, gain: 0.16, attack: 0.02, wet: 0.35 });
  knock(300, 0.05, 0.3, 0.03);
}

/** Your plate went. Dark, close, final. */
export function sfxYouDied(): void {
  if (sample("died", 1, 0.5)) return;
  sub({ freq: 92, glideTo: 26, dur: 1.25, gain: 0.3, attack: 0.005, wet: 0.45 });
  texture({ dur: 0.5, gain: 0.15, freq: 1500, sweepTo: 160, q: 1.1, wet: 0.55 });
  texture({
    dur: 0.9,
    gain: 0.06,
    freq: 300,
    sweepTo: 90,
    q: 0.6,
    type: "lowpass",
    attack: 0.05,
    wet: 0.7,
    delay: 0.08,
  });
}

/** The lattice sealing. Low, solid, a door closing. */
export function sfxSeal(): void {
  if (sample("seal", 0.9, 0.4)) return;
  sub({ freq: 128, glideTo: 54, dur: 0.5, gain: 0.19, attack: 0.01, wet: 0.4 });
  texture({ dur: 0.19, gain: 0.07, freq: 520, sweepTo: 170, q: 1.1, wet: 0.35 });
}

/** You bonded in. A single quiet, low confirmation. */
export function sfxJoin(): void {
  if (sample("join", 0.8, 0.25)) return;
  knock(210, 0.09, 0.28);
  sub({ freq: 140, dur: 0.22, gain: 0.07, attack: 0.014, wet: 0.3 });
}

/**
 * The jackpot — the one moment allowed to be musical.
 *
 * Structure is the standard three-part celebration cue: a riser that builds
 * anticipation, an impact that lands it, then a warm sustained pad that hangs
 * in the reverb while the overlay plays. The pad is a filtered saw stack, not
 * bells: an open fifth with the octave above it, lowpassed so it stays warm
 * and never turns into a sparkle.
 */
export function sfxBonanza(): void {
  if (sample("bonanza", 1, 0.5)) return;
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime;

  // Riser: 1.1s of noise sweeping up into the hit.
  texture({
    dur: 1.1,
    gain: 0.09,
    freq: 260,
    sweepTo: 5200,
    q: 1.4,
    attack: 0.5,
    wet: 0.5,
  });

  // Impact.
  const hit = 1.1;
  sub({ freq: 78, glideTo: 40, dur: 1.5, gain: 0.32, attack: 0.006, wet: 0.35, delay: hit });
  texture({ dur: 0.5, gain: 0.13, freq: 1500, sweepTo: 200, q: 0.9, wet: 0.6, delay: hit });

  // The pad: C2 / G2 / C3 / G3. Slow attack, long release, well behind the hit.
  for (const [freq, level] of [
    [65.4, 0.075],
    [98.0, 0.06],
    [130.8, 0.05],
    [196.0, 0.032],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() - 0.5) * 9;

    // Filter opens as the chord blooms, which is what makes a pad breathe.
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(240, t0 + hit);
    lp.frequency.linearRampToValueAtTime(1500, t0 + hit + 1.2);
    lp.frequency.linearRampToValueAtTime(500, t0 + hit + 3.4);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0 + hit);
    g.gain.linearRampToValueAtTime(level, t0 + hit + 0.35);
    g.gain.setValueAtTime(level, t0 + hit + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + hit + 3.6);

    osc.connect(lp);
    lp.connect(g);
    connectVoice(g, 0.55);
    osc.start(t0 + hit);
    osc.stop(t0 + hit + 3.7);
  }
}
