import { hexPath } from "./cells";

/**
 * Hand-drawn ice plate faces.
 *
 * Four stills live in `public/tiles/`, each the same hexagon at a different
 * stage of failure. They are baked once per layout into hex-clipped canvases
 * at the exact plate size, so the per-frame cost is a plain blit — the same as
 * the procedural sprites they sit on top of.
 *
 *     base      pristine ice
 *     hairline  first fractures
 *     heavy     failing
 *     crack     coming apart (death)
 *
 * Missing files simply leave the procedural plates in place, so the lattice
 * never depends on art existing.
 */

export type TileName = "base" | "hairline" | "heavy" | "crack";

const NAMES: TileName[] = ["base", "hairline", "heavy", "crack"];
const images = new Map<TileName, HTMLImageElement>();
let probed = false;
/** Bumped as art arrives, so a built atlas knows it is stale. */
export let tileVersion = 0;

export function initTileAssets(): void {
  if (probed) return;
  probed = true;
  const base = import.meta.env.BASE_URL || "/";
  for (const name of NAMES) {
    const img = new Image();
    img.onload = () => {
      images.set(name, img);
      tileVersion++;
    };
    img.src = `${base}tiles/${name}.png`;
  }
}

export function tilesReady(): boolean {
  return images.has("base");
}

/** Plate faces baked to one radius. Rebuilt whenever the layout changes. */
export class TileAtlas {
  readonly version: number;
  readonly w: number;
  readonly h: number;
  private baked = new Map<TileName, HTMLCanvasElement>();

  constructor(r: number, dpr: number) {
    this.version = tileVersion;
    this.w = r * 2;
    this.h = r * Math.sqrt(3);

    for (const name of NAMES) {
      const img = images.get(name);
      if (!img) continue;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(this.w * dpr);
      canvas.height = Math.ceil(this.h * dpr);
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);

      ctx.save();
      hexPath(ctx, this.w / 2, this.h / 2, r);
      ctx.clip();

      // Cover-fit: the art is drawn as the same flat-top hexagon, so this is
      // near enough an exact overlay; the clip absorbs any overhang.
      const s = Math.max(this.w / img.width, this.h / img.height);
      const dw = img.width * s;
      const dh = img.height * s;
      // Crunchy when blown up, filtered when shrunk — nearest-neighbour
      // downscaling of dense pixel art turns cracks into moire.
      ctx.imageSmoothingEnabled = dw < img.width * 0.9;
      ctx.drawImage(img, (this.w - dw) / 2, (this.h - dh) / 2, dw, dh);
      ctx.restore();

      this.baked.set(name, canvas);
    }
  }

  get(name: TileName): HTMLCanvasElement | null {
    return this.baked.get(name) ?? null;
  }

  get usable(): boolean {
    return this.baked.has("base");
  }
}
