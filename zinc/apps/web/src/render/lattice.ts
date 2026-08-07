import { CellAtlas, hexPath, type CellState } from "./cells";

/**
 * The seam.
 *
 * The shaft is a hexagonal lattice of ore, one plate per player. Danger is not
 * drawn as weather sitting on top of the scene — it comes from *between* the
 * plates. As the hazard climbs, the seams behind the lattice heat from cold
 * zinc blue through violet to crimson, so the room is lit by the thing that is
 * about to kill you.
 *
 * Plates hold fixed positions for the whole round. Nothing reflows when a
 * player dies, so the lattice erodes into voids and the emptying grid is what
 * explains the multiplier climbing.
 */

export interface CellInput {
  id: number;
  state: CellState;
}

export interface LatticeSnapshot {
  cells: CellInput[];
  hazard: number;
  grace: boolean;
  phase: "lobby" | "live" | "result";
  /** Timestamp the jackpot fired, or null. Drives the gold flood. */
  bonanzaAt: number | null;
}

interface Cell {
  id: number;
  x: number;
  y: number;
  state: CellState;
  /** Seconds since the state last changed. */
  t: number;
  /** Per-cell phase offset so the lattice never shimmers in unison. */
  seed: number;
  /** Spawn-in progress, 0-1. */
  born: number;
}

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  life: number;
  maxLife: number;
  kind: "ore" | "value" | "gold";
}

const COLD = [90, 150, 190] as const;
const WARM = [150, 110, 235] as const;
const HOT = [255, 45, 111] as const;

function lerp3(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
}

function seamColor(h: number): [number, number, number] {
  const t = Math.min(1, h / 0.13);
  return t < 0.5 ? lerp3(COLD, WARM, t / 0.5) : lerp3(WARM, HOT, (t - 0.5) / 0.5);
}

export class LatticeRenderer {
  private ctx: CanvasRenderingContext2D;
  private atlas: CellAtlas | null = null;
  private cells = new Map<number, Cell>();
  private shards: Shard[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private time = 0;
  private heat = 0;
  private heatTarget = 0;
  private shake = 0;
  private raf = 0;
  private last = 0;
  private snap: LatticeSnapshot = {
    cells: [],
    hazard: 0,
    grace: false,
    phase: "lobby",
    bonanzaAt: null,
  };
  private goldWave = 0;
  private layoutKey = "";
  private radius = 20;
  private bounds = { x: 0, y: 0, w: 0, h: 0 };
  private sink = { x: 0.5, y: 0.13 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
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

  setSinkPoint(x: number, y: number): void {
    this.sink = { x, y };
  }

  /** Nearest cell to a canvas-space point, if the click landed on one. */
  hitTest(px: number, py: number): number | null {
    let best: number | null = null;
    let bestD = this.radius * this.radius * 1.25;
    for (const c of this.cells.values()) {
      const dx = px - c.x;
      const dy = py - c.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = c.id;
      }
    }
    return best;
  }

  /** Screen position of a cell, for anchoring a popover. */
  cellPosition(id: number): { x: number; y: number } | null {
    const c = this.cells.get(id);
    return c ? { x: c.x, y: c.y } : null;
  }

  update(snap: LatticeSnapshot): void {
    const wasBonanza = this.snap.bonanzaAt;
    this.snap = snap;
    if (snap.bonanzaAt && snap.bonanzaAt !== wasBonanza) {
      this.goldWave = 1;
      this.eruptGold();
    }
    this.heatTarget = snap.grace ? 0.05 : Math.min(1, snap.hazard / 0.14);

    const key = `${snap.cells.length}:${this.w | 0}:${this.h | 0}`;
    if (key !== this.layoutKey) {
      this.layout(snap.cells);
      this.layoutKey = key;
    }

    let deaths = 0;
    for (const input of snap.cells) {
      const cell = this.cells.get(input.id);
      if (!cell || cell.state === input.state) continue;
      cell.state = input.state;
      cell.t = 0;
      if (input.state === "dying") {
        deaths++;
        this.fracture(cell);
      } else if (input.state === "cashed") {
        this.release(cell);
      }
    }
    if (deaths > 0) this.shake = Math.min(1, this.shake + 0.14 + deaths * 0.04);
  }

  /**
   * Packs flat-top hexes into the largest grid that fits the viewport. Cell
   * size falls out of the population, so a small lobby gets chunky plates and a
   * packed one gets fine ore.
   */
  private layout(inputs: CellInput[]): void {
    const n = inputs.length;
    if (n === 0) {
      this.cells.clear();
      return;
    }

    const padX = this.w * 0.05;
    const padY = this.h * 0.16;
    const availW = this.w - padX * 2;
    const availH = this.h - padY * 2;

    // Shrink until the grid genuinely holds every cell.
    let r = Math.sqrt((availW * availH) / (2.6 * n));
    let cols = 0;
    let rows = 0;
    for (let guard = 0; guard < 200; guard++) {
      cols = Math.max(1, Math.floor((availW - r * 0.5) / (r * 1.5)));
      rows = Math.max(1, Math.floor(availH / (r * Math.sqrt(3))));
      if (cols * rows >= n || r <= 3) break;
      r *= 0.94;
    }
    r = Math.max(3, r);
    this.radius = r;
    this.atlas = new CellAtlas(r, this.dpr);

    const usedCols = Math.min(cols, Math.ceil(n / rows));
    const gridW = usedCols * r * 1.5 + r * 0.5;
    const gridH = rows * r * Math.sqrt(3);
    const startX = (this.w - gridW) / 2 + r;
    const startY = (this.h - gridH) / 2 + (r * Math.sqrt(3)) / 2;

    this.bounds = { x: startX - r * 1.2, y: startY - r, w: gridW + r * 0.4, h: gridH + r };

    const kept = new Map<number, Cell>();
    inputs.forEach((input, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const x = startX + col * r * 1.5;
      const y = startY + row * r * Math.sqrt(3) + (col % 2 ? (r * Math.sqrt(3)) / 2 : 0);
      const prev = this.cells.get(input.id);
      kept.set(input.id, {
        id: input.id,
        x,
        y,
        state: input.state,
        t: prev?.t ?? 0,
        seed: ((input.id * 2654435761) >>> 0) / 4294967296,
        born: prev?.born ?? 0,
      });
    });
    this.cells = kept;
  }

  /** A plate breaking apart. Shards carry its value toward the multiplier. */
  private fracture(cell: Cell): void {
    const r = this.radius;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 130;
      this.shards.push({
        x: cell.x,
        y: cell.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 9,
        size: r * (0.16 + Math.random() * 0.3),
        life: 0,
        maxLife: 0.7 + Math.random() * 0.5,
        kind: i < 4 ? "value" : "ore",
      });
    }
  }

  /**
   * The jackpot. Every plate in the lattice throws gold at once — the one
   * moment the scene is allowed to be warm.
   */
  private eruptGold(): void {
    const r = this.radius;
    for (const c of this.cells.values()) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 90 + Math.random() * 260;
        this.shards.push({
          x: c.x,
          y: c.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 120,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 14,
          size: r * (0.2 + Math.random() * 0.35),
          life: 0,
          maxLife: 1.6 + Math.random() * 1.2,
          kind: "gold",
        });
      }
    }
  }

  /** A plate lifted out cleanly. Drifts up, no value released. */
  private release(cell: Cell): void {
    const r = this.radius;
    for (let i = 0; i < 3; i++) {
      this.shards.push({
        x: cell.x + (Math.random() - 0.5) * r,
        y: cell.y,
        vx: (Math.random() - 0.5) * 25,
        vy: -50 - Math.random() * 40,
        rot: 0,
        vrot: (Math.random() - 0.5) * 2,
        size: r * 0.14,
        life: 0,
        maxLife: 0.8,
        kind: "ore",
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
    this.heat += (this.heatTarget - this.heat) * Math.min(1, dt * 3.5);
    this.shake *= Math.pow(0.002, dt);
    if (this.goldWave > 0) this.goldWave = Math.max(0, this.goldWave - dt / 6);

    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.01) {
      const s = this.shake * 4.5;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.drawRock();
    this.drawSeams();
    this.drawCells(dt);
    this.drawShards(dt);
    if (this.goldWave > 0) this.drawGoldFlood();
    this.drawAtmosphere();

    ctx.restore();
  }

  /** Jackpot wash. Warm light floods the cold lattice, then drains away. */
  private drawGoldFlood(): void {
    const { ctx, w, h } = this;
    const k = this.goldWave;
    const burst = Math.min(1, (1 - k) * 5);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      0,
      w / 2,
      h / 2,
      Math.max(w, h) * (0.35 + burst * 0.5),
    );
    const a = k * 0.7;
    g.addColorStop(0, `rgba(255,206,110,${a})`);
    g.addColorStop(0.5, `rgba(255,160,50,${a * 0.5})`);
    g.addColorStop(1, "rgba(255,120,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Expanding shock ring on the initial hit.
    if (burst < 1) {
      ctx.globalAlpha = (1 - burst) * 0.8;
      ctx.strokeStyle = "#ffe6a8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, burst * Math.max(w, h) * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawRock(): void {
    const { ctx, w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#04070a");
    g.addColorStop(0.5, "#070c11");
    g.addColorStop(1, "#04070a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * The heat behind the lattice. Plates are drawn opaque on top, so this shows
   * only through the gaps — the grid appears backlit along its seams.
   */
  private drawSeams(): void {
    const { ctx } = this;
    const b = this.bounds;
    if (b.w <= 0) return;
    const [r, g, bl] = seamColor(this.snap.grace ? 0.005 : this.snap.hazard);
    const pulse = 0.82 + Math.sin(this.time * 2.1) * 0.06 + this.heat * 0.3;

    ctx.save();
    const grad = ctx.createRadialGradient(
      b.x + b.w / 2,
      b.y + b.h / 2,
      0,
      b.x + b.w / 2,
      b.y + b.h / 2,
      Math.max(b.w, b.h) * 0.72,
    );
    const a = (0.16 + this.heat * 0.7) * pulse;
    grad.addColorStop(0, `rgba(${r | 0},${g | 0},${bl | 0},${a})`);
    grad.addColorStop(1, `rgba(${r | 0},${g | 0},${bl | 0},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(b.x - 40, b.y - 40, b.w + 80, b.h + 80);

    // A second tighter core so high hazard reads as genuinely molten.
    if (this.heat > 0.25) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (this.heat - 0.25) * 0.5;
      ctx.fillStyle = grad;
      ctx.fillRect(b.x - 40, b.y - 40, b.w + 80, b.h + 80);
    }
    ctx.restore();
  }

  private drawCells(dt: number): void {
    const { ctx } = this;
    const atlas = this.atlas;
    if (!atlas) return;

    for (const c of this.cells.values()) {
      c.t += dt;
      if (c.born < 1) c.born = Math.min(1, c.born + dt * 4);

      let alpha = 1;
      let scale = 1;
      let dy = 0;

      if (c.born < 1) {
        // Crystallising in as a player joins the lobby.
        const k = c.born;
        alpha = k;
        scale = 0.55 + 0.45 * (1 - Math.pow(1 - k, 3));
      }

      if (c.state === "dying") {
        const k = Math.min(1, c.t / 0.5);
        alpha *= 1 - k;
        scale *= 1 - k * 0.3;
        if (k >= 1) continue;
      } else if (c.state === "cashed") {
        const k = Math.min(1, c.t / 0.55);
        alpha *= 1 - k * 0.45;
        dy = -k * 3;
      } else if (c.state === "you") {
        scale *= 1 + Math.sin(this.time * 3 + c.seed * 6) * 0.018;
      }

      if (alpha <= 0.02) continue;

      const sprite = atlas.get(c.state);
      ctx.globalAlpha = alpha;
      const dw = sprite.w * scale;
      const dh = sprite.h * scale;
      ctx.drawImage(sprite.canvas, c.x - dw / 2, c.y - dh / 2 + dy, dw, dh);

      // Fracture lines race across the plate in the instant before it breaks.
      if (c.state === "dying" && c.t < 0.26 && this.radius > 6) {
        const k = c.t / 0.26;
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.95;
        ctx.strokeStyle = "#ffd9e6";
        ctx.lineWidth = Math.max(0.7, this.radius * 0.06);
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = c.seed * 6.28 + (i * Math.PI * 2) / 3;
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(
            c.x + Math.cos(a) * this.radius * k * 1.1,
            c.y + Math.sin(a) * this.radius * k * 1.1,
          );
        }
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Broken ore in flight. Value shards home in on the multiplier. */
  private drawShards(dt: number): void {
    const { ctx, w, h } = this;
    const sinkX = this.sink.x * w;
    const sinkY = this.sink.y * h;

    ctx.save();
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i]!;
      s.life += dt;
      const k = s.life / s.maxLife;
      if (k >= 1) {
        this.shards.splice(i, 1);
        continue;
      }

      if (s.kind === "value") {
        const dx = sinkX - s.x;
        const dy = sinkY - s.y;
        const d = Math.hypot(dx, dy) || 1;
        const pull = 420 * Math.pow(k, 1.6);
        s.vx += (dx / d) * pull * dt;
        s.vy += (dy / d) * pull * dt;
      } else if (s.kind === "gold") {
        s.vy += 220 * dt;
        s.vx *= 1 - 0.6 * dt;
      } else {
        s.vy += 180 * dt;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.vrot * dt;

      const a = (1 - k) * 0.95;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      if (s.kind === "value") {
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.size * 3.2);
        g.addColorStop(0, `rgba(255,120,170,${a})`);
        g.addColorStop(1, "rgba(255,45,111,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-s.size * 3.2, -s.size * 3.2, s.size * 6.4, s.size * 6.4);
      }
      if (s.kind === "gold") {
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.size * 4);
        g.addColorStop(0, `rgba(255,214,120,${a})`);
        g.addColorStop(1, "rgba(255,150,40,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-s.size * 4, -s.size * 4, s.size * 8, s.size * 8);
      }
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(0, -s.size);
      ctx.lineTo(s.size * 0.9, s.size * 0.7);
      ctx.lineTo(-s.size * 0.8, s.size * 0.6);
      ctx.closePath();
      ctx.fillStyle =
        s.kind === "value" ? "#ff9dbe" : s.kind === "gold" ? "#ffd36b" : "#4a6478";
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** Depth haze and vignette. Kept minimal so the lattice stays the subject. */
  private drawAtmosphere(): void {
    const { ctx, w, h } = this;
    const g = ctx.createRadialGradient(
      w / 2,
      h * 0.5,
      Math.min(w, h) * 0.3,
      w / 2,
      h * 0.5,
      Math.max(w, h) * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

export { hexPath };
