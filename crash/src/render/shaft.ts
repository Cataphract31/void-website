import { FigureAtlas, buildDustLayer, type FigureState } from "./atlas";

/**
 * The shaft: a chamber seen head-on, packed with miners, filling with CO2.
 *
 * Two ideas do the heavy lifting.
 *
 * Depth by row. Figures sit in rows that get smaller, dimmer and hazier toward
 * the back, so a crowd reads as volume without any 3D. It also means the same
 * layout works for eight players and for a thousand — more people just means
 * more rows, packed tighter, until individuals dissolve into a mass.
 *
 * Fixed positions. When someone dies or leaves, nobody shuffles up. Gaps stay
 * open, so the crowd visibly erodes rather than politely re-flowing, and the
 * emptying room is the thing that explains the number climbing.
 */

export interface FigureInput {
  id: number;
  state: FigureState;
}

export interface ShaftSnapshot {
  figures: FigureInput[];
  /** Elimination chance this tick, 0-1. Drives the CO2 level and colour grade. */
  hazard: number;
  /** True during the opening grace ticks, when the air is still safe. */
  grace: boolean;
  phase: "lobby" | "live" | "result";
}

interface Figure {
  id: number;
  x: number;
  y: number;
  size: number;
  row: number;
  depth: number;
  phase: number;
  state: FigureState;
  /** Seconds since the figure changed to a terminal state. */
  t: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: "ember" | "cash";
}

const CO2_SAFE = [46, 196, 182] as const;
const CO2_WARN = [255, 178, 69] as const;
const CO2_HOT = [255, 61, 47] as const;

function mix(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [
    a[0]! + (b[0]! - a[0]!) * t,
    a[1]! + (b[1]! - a[1]!) * t,
    a[2]! + (b[2]! - a[2]!) * t,
  ];
}

/** Maps hazard to a colour: clear teal, sodium amber, then toxic red. */
function hazardColor(h: number): [number, number, number] {
  const t = Math.min(1, h / 0.14);
  return t < 0.5 ? mix(CO2_SAFE, CO2_WARN, t / 0.5) : mix(CO2_WARN, CO2_HOT, (t - 0.5) / 0.5);
}

export class ShaftRenderer {
  private ctx: CanvasRenderingContext2D;
  private atlas: FigureAtlas;
  private dust: HTMLCanvasElement;
  private figures = new Map<number, Figure>();
  private particles: Particle[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private time = 0;
  private co2 = 0;
  private co2Target = 0;
  private shake = 0;
  private raf = 0;
  private last = 0;
  private snapshot: ShaftSnapshot = { figures: [], hazard: 0, grace: false, phase: "lobby" };
  private layoutKey = "";
  /** Screen-space point that value flows toward: the hero multiplier. */
  private sink = { x: 0.5, y: 0.12 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.atlas = new FigureAtlas(this.dpr);
    this.dust = buildDustLayer(512, 512, 420);
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.ceil(this.w * this.dpr);
    this.canvas.height = Math.ceil(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.layoutKey = "";
  }

  setSinkPoint(xFrac: number, yFrac: number): void {
    this.sink = { x: xFrac, y: yFrac };
  }

  update(snap: ShaftSnapshot): void {
    const prev = this.snapshot;
    this.snapshot = snap;
    this.co2Target = snap.grace ? 0.06 : Math.min(1, snap.hazard / 0.16);

    const key = `${snap.figures.length}:${this.w | 0}:${this.h | 0}`;
    if (key !== this.layoutKey) {
      this.layout(snap.figures);
      this.layoutKey = key;
    }

    // Detect transitions so deaths and exits can throw particles.
    let deaths = 0;
    for (const input of snap.figures) {
      const fig = this.figures.get(input.id);
      if (!fig) continue;
      if (fig.state !== input.state) {
        fig.state = input.state;
        fig.t = 0;
        if (input.state === "dying") {
          deaths++;
          this.burst(fig, "ember");
        } else if (input.state === "cashed") {
          this.burst(fig, "cash");
        }
      }
    }
    if (deaths > 0 && prev.phase === "live") {
      this.shake = Math.min(1, this.shake + 0.18 + deaths * 0.05);
    }
  }

  /**
   * Packs figures into rows that recede upward. Row count and figure size are
   * chosen so the crowd fills the chamber at any population.
   */
  private layout(inputs: FigureInput[]): void {
    const n = inputs.length;
    if (n === 0) {
      this.figures.clear();
      return;
    }

    const floorTop = this.h * 0.42;
    const floorBottom = this.h * 0.9;
    const usableH = floorBottom - floorTop;
    const usableW = this.w * 0.94;

    // Aim for roughly square cells, then bias toward more rows as the crowd
    // grows so depth carries the density rather than horizontal crush.
    const rows = Math.max(2, Math.min(14, Math.round(Math.sqrt(n) * 0.85)));
    const perRow = Math.ceil(n / rows);
    const cellW = usableW / perRow;
    const baseSize = Math.max(6, Math.min(38, Math.min(cellW * 1.55, (usableH / rows) * 1.5)));

    const kept = new Map<number, Figure>();
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const depth = rows === 1 ? 1 : r / (rows - 1);
      // Back rows sit higher, smaller and offset; front rows dominate.
      const rowY = floorTop + usableH * Math.pow(1 - depth, 0.85);
      const scale = 0.5 + 0.5 * (1 - depth);
      const size = this.atlas.nearestSize(baseSize * scale);
      const count = Math.min(perRow, n - i);
      if (count <= 0) break;
      const spread = usableW * (0.72 + 0.28 * (1 - depth));
      const startX = (this.w - spread) / 2;
      const step = count > 1 ? spread / (count - 1) : 0;

      for (let c = 0; c < count; c++, i++) {
        const input = inputs[i]!;
        const seed = (input.id * 2654435761) >>> 0;
        const jx = ((seed & 0xff) / 255 - 0.5) * step * 0.5;
        const jy = (((seed >> 8) & 0xff) / 255 - 0.5) * size * 0.25;
        const existing = this.figures.get(input.id);
        kept.set(input.id, {
          id: input.id,
          x: count > 1 ? startX + c * step + jx : this.w / 2,
          y: rowY + jy,
          size,
          row: r,
          depth,
          phase: ((seed >> 16) & 0xff) / 255 * Math.PI * 2,
          state: input.state,
          t: existing?.t ?? 0,
        });
      }
    }
    this.figures = kept;
  }

  private burst(fig: Figure, hue: Particle["hue"]): void {
    const count = hue === "ember" ? 9 : 5;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 70;
      this.particles.push({
        x: fig.x,
        y: fig.y - fig.size * 0.5,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0,
        maxLife: 0.75 + Math.random() * 0.5,
        size: 1 + Math.random() * 2,
        hue,
      });
    }
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number): void => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame(dt: number): void {
    this.time += dt;
    this.co2 += (this.co2Target - this.co2) * Math.min(1, dt * 4);
    this.shake *= Math.pow(0.0015, dt);

    const ctx = this.ctx;
    const { w, h } = this;
    const color = hazardColor(this.snapshot.grace ? 0.01 : this.snapshot.hazard);

    ctx.save();
    if (this.shake > 0.01) {
      const s = this.shake * 5;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.drawBackground(ctx, w, h, color);
    this.drawLamps(ctx, w, h);
    this.drawDust(ctx, w, h);
    this.drawFigures(ctx, dt);
    this.drawParticles(ctx, dt, w, h);
    this.drawCO2(ctx, w, h, color);
    this.drawVignette(ctx, w, h);

    ctx.restore();
  }

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    color: [number, number, number],
  ): void {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#05070a");
    g.addColorStop(0.55, "#0a0e14");
    g.addColorStop(1, "#0d1219");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Rock face: a few darker strata so the chamber has material.
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 7; i++) {
      const y = h * (0.08 + i * 0.13) + Math.sin(this.time * 0.05 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y - 12 - i * 2, w * 0.7, y + 10 + i, w, y - 4);
      ctx.strokeStyle = i % 2 ? "#11161d" : "#0c1117";
      ctx.lineWidth = 6 + (i % 3) * 4;
      ctx.stroke();
    }
    ctx.restore();

    // Floor
    const fg = ctx.createLinearGradient(0, h * 0.86, 0, h);
    fg.addColorStop(0, "rgba(0,0,0,0)");
    fg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, h * 0.86, w, h * 0.14);

    // A faint wash of the hazard colour ties the whole scene to the risk level.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.05 + this.co2 * 0.09;
    ctx.fillStyle = `rgb(${color[0] | 0},${color[1] | 0},${color[2] | 0})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** Sodium lamps hung from the roof, casting cones into the dust. */
  private drawLamps(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const lamps = w < 520 ? 2 : 3;
    for (let i = 0; i < lamps; i++) {
      const x = (w * (i + 0.5)) / lamps;
      const flicker = 0.86 + Math.sin(this.time * (7 + i * 3) + i) * 0.05 + Math.random() * 0.03;
      const g = ctx.createRadialGradient(x, h * 0.04, 0, x, h * 0.04, h * 0.7);
      g.addColorStop(0, `rgba(255,196,120,${0.3 * flicker})`);
      g.addColorStop(0.35, `rgba(255,170,90,${0.09 * flicker})`);
      g.addColorStop(1, "rgba(255,150,70,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.02);
      ctx.lineTo(x - w * 0.36, h);
      ctx.lineTo(x + w * 0.36, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawDust(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let layer = 0; layer < 2; layer++) {
      const speed = layer === 0 ? 6 : 14;
      const off = (this.time * speed) % 512;
      ctx.globalAlpha = layer === 0 ? 0.5 : 0.28;
      for (let x = -512; x < w + 512; x += 512) {
        for (let y = -512; y < h + 512; y += 512) {
          ctx.drawImage(this.dust, x + ((layer * 137) % 512), y + off);
        }
      }
    }
    ctx.restore();
  }

  private drawFigures(ctx: CanvasRenderingContext2D, dt: number): void {
    const sorted = [...this.figures.values()].sort((a, b) => a.row - b.row);
    for (const f of sorted) {
      f.t += dt;

      let alpha = 1;
      let dy = 0;
      let scale = 1;

      if (f.state === "dying") {
        const k = Math.min(1, f.t / 0.55);
        alpha = 1 - k;
        dy = k * 14;
        scale = 1 - k * 0.35;
        if (k >= 1) continue;
      } else if (f.state === "cashed") {
        const k = Math.min(1, f.t / 0.9);
        alpha = 1 - k * 0.85;
        dy = -k * 40;
        if (k >= 1) alpha = 0.15;
      } else {
        // Idle breathing, offset per figure so the crowd never pulses in sync.
        dy = Math.sin(this.time * 1.6 + f.phase) * f.size * 0.03;
      }

      // Back rows sit in more haze.
      alpha *= 0.45 + 0.55 * (1 - f.depth);
      if (alpha <= 0.02) continue;

      const sprite = this.atlas.get(f.state, f.size);
      ctx.globalAlpha = alpha;
      const drawW = sprite.w * scale;
      const drawH = sprite.h * scale;
      ctx.drawImage(sprite.canvas, f.x - drawW / 2, f.y - drawH + dy, drawW, drawH);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Value in flight. Embers from the eliminated arc toward the multiplier, so
   * the number climbing is visibly paid for by somebody.
   */
  private drawParticles(
    ctx: CanvasRenderingContext2D,
    dt: number,
    w: number,
    h: number,
  ): void {
    const sinkX = this.sink.x * w;
    const sinkY = this.sink.y * h;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      const k = p.life / p.maxLife;
      if (k >= 1) {
        this.particles.splice(i, 1);
        continue;
      }

      // Accelerate toward the sink so the flow of value is unmistakable.
      const dx = sinkX - p.x;
      const dy = sinkY - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = 260 * Math.pow(k, 1.5);
      p.vx += (dx / dist) * pull * dt;
      p.vy += (dy / dist) * pull * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const a = (1 - k) * 0.9;
      const r = p.size * (1 - k * 0.4);
      const col = p.hue === "ember" ? "255,150,60" : "125,255,196";
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** CO2 pools at the roof and presses down as the hazard climbs. */
  private drawCO2(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    color: [number, number, number],
  ): void {
    const level = this.co2;
    if (level <= 0.001) return;
    const edgeY = h * (0.06 + level * 0.62);
    const [r, g, b] = color;

    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, edgeY);
    grad.addColorStop(0, `rgba(${r | 0},${g | 0},${b | 0},${0.3 + level * 0.3})`);
    grad.addColorStop(0.65, `rgba(${r | 0},${g | 0},${b | 0},${0.12 + level * 0.2})`);
    grad.addColorStop(1, `rgba(${r | 0},${g | 0},${b | 0},0)`);
    ctx.fillStyle = grad;

    // A drifting boundary, so the gas looks alive rather than like a progress bar.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, edgeY);
    const steps = 24;
    for (let i = steps; i >= 0; i--) {
      const x = (w * i) / steps;
      const wob =
        Math.sin(x * 0.011 + this.time * 0.9) * 7 +
        Math.sin(x * 0.027 - this.time * 1.5) * 4 +
        Math.sin(x * 0.005 + this.time * 0.4) * 9;
      ctx.lineTo(x, edgeY + wob);
    }
    ctx.closePath();
    ctx.fill();

    // Bright rim right at the gas front.
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = (w * i) / steps;
      const wob =
        Math.sin(x * 0.011 + this.time * 0.9) * 7 +
        Math.sin(x * 0.027 - this.time * 1.5) * 4 +
        Math.sin(x * 0.005 + this.time * 0.4) * 9;
      if (i === 0) ctx.moveTo(x, edgeY + wob);
      else ctx.lineTo(x, edgeY + wob);
    }
    ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${0.25 + level * 0.45})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createRadialGradient(
      w / 2,
      h * 0.52,
      Math.min(w, h) * 0.25,
      w / 2,
      h * 0.52,
      Math.max(w, h) * 0.78,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
