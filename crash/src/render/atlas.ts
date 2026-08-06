/**
 * Pre-rendered sprite atlas.
 *
 * Every miner is drawn once, offscreen, at a handful of sizes and states, then
 * blitted thousands of times per frame. Drawing paths per figure per frame is
 * what makes canvas crowds crawl on phones; drawing an image does not.
 *
 * The figure is deliberately a silhouette with a headlamp rather than a dot —
 * at 10px it still reads as a person facing you, and the lamp gives every
 * figure a light source to flicker.
 */

export type FigureState = "alive" | "you" | "dying" | "cashed";

/** Sizes are the rendered heights in CSS pixels, before devicePixelRatio. */
const SIZES = [8, 11, 14, 18, 23, 30, 38] as const;

export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

const PALETTE: Record<FigureState, { body: string; helmet: string; lamp: string }> = {
  alive: { body: "#33414f", helmet: "#4a5c6d", lamp: "#ffc978" },
  you: { body: "#166b78", helmet: "#2ba5b8", lamp: "#8ff0ff" },
  dying: { body: "#6b2a24", helmet: "#a33a2c", lamp: "#ff6b4a" },
  cashed: { body: "#1d5a4a", helmet: "#2f8f70", lamp: "#7dffc4" },
};

function drawFigure(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: FigureState,
  dpr: number,
): void {
  const c = PALETTE[state];
  ctx.save();
  ctx.scale(dpr, dpr);

  const cx = w / 2;
  const headR = h * 0.17;
  const headY = h * 0.22;
  const shoulderY = h * 0.4;
  const bodyW = h * 0.34;

  // Body: a tapered torso, wider at the shoulders. Reads as a person even at
  // single-digit pixel heights.
  ctx.beginPath();
  ctx.moveTo(cx - bodyW * 0.5, h);
  ctx.lineTo(cx - bodyW * 0.42, shoulderY);
  ctx.quadraticCurveTo(cx, shoulderY - h * 0.06, cx + bodyW * 0.42, shoulderY);
  ctx.lineTo(cx + bodyW * 0.5, h);
  ctx.closePath();
  ctx.fillStyle = c.body;
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fillStyle = c.body;
  ctx.fill();

  // Helmet: a dome plus a short brim, the shape that sells "miner".
  ctx.beginPath();
  ctx.arc(cx, headY, headR * 1.12, Math.PI, 0);
  ctx.lineTo(cx + headR * 1.5, headY + headR * 0.16);
  ctx.lineTo(cx - headR * 1.5, headY + headR * 0.16);
  ctx.closePath();
  ctx.fillStyle = c.helmet;
  ctx.fill();

  // Headlamp with a soft bloom.
  const lampY = headY - headR * 0.15;
  const g = ctx.createRadialGradient(cx, lampY, 0, cx, lampY, headR * 2.2);
  g.addColorStop(0, c.lamp);
  g.addColorStop(0.35, c.lamp + "88");
  g.addColorStop(1, "transparent");
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, lampY, headR * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  ctx.arc(cx, lampY, Math.max(0.6, headR * 0.32), 0, Math.PI * 2);
  ctx.fillStyle = c.lamp;
  ctx.fill();

  ctx.restore();
}

export class FigureAtlas {
  private sprites = new Map<string, Sprite>();
  readonly sizes = SIZES;

  constructor(private readonly dpr: number) {
    for (const state of ["alive", "you", "dying", "cashed"] as FigureState[]) {
      for (const size of SIZES) {
        this.sprites.set(`${state}:${size}`, this.build(state, size));
      }
    }
  }

  private build(state: FigureState, size: number): Sprite {
    const w = Math.ceil(size * 0.62);
    const h = size;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(w * this.dpr);
    canvas.height = Math.ceil(h * this.dpr);
    const ctx = canvas.getContext("2d")!;
    drawFigure(ctx, w, h, state, this.dpr);
    return { canvas, w, h };
  }

  /** Snaps to the nearest pre-rendered size so blits stay pixel-clean. */
  nearestSize(target: number): number {
    let best: number = SIZES[0]!;
    let bestD = Infinity;
    for (const s of SIZES) {
      const d = Math.abs(s - target);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  get(state: FigureState, size: number): Sprite {
    return this.sprites.get(`${state}:${size}`) ?? this.sprites.get(`alive:${SIZES[0]}`)!;
  }
}

/**
 * Pre-baked dust texture. Scrolled and parallaxed at two depths, this sells
 * "airborne particulate" for the cost of two drawImage calls.
 */
export function buildDustLayer(w: number, h: number, count: number, seed = 1): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  let s = seed;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.4 + rand() * 1.5;
    const a = 0.05 + rand() * 0.22;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,214,170,${a})`;
    ctx.fill();
  }
  return canvas;
}
