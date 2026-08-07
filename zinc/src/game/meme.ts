/**
 * Meme avatar assets.
 *
 * The owner's requested skin: players still in the round wear the big-chin
 * chad head, eliminated players get the snowflake, and the round ends on a
 * slap. Real art is dropped into `apps/web/public/meme/` as PNGs and is used
 * automatically — until then the emoji placeholders below stand in, so the
 * whole layer can be judged before any art exists.
 *
 *     chad.png       still-in / cashed players (and the slapper)
 *     snowflake.png  eliminated players (and the slapped)
 *     slap.png       optional single-frame override for the end-of-round scene
 *
 * The layer is a toggle (dev panel → "meme mode"), so the base product stays
 * presentable with it off and the skin can be demoed on demand.
 */

export type MemeName = "chad" | "snowflake" | "slap";

const urls = new Map<MemeName, string>();
let probed = false;

/** Kicks off the probe once. Loads are async; the UI re-renders every tick anyway. */
export function initMemeAssets(): void {
  if (probed) return;
  probed = true;
  const base = import.meta.env.BASE_URL || "/";
  for (const name of ["chad", "snowflake", "slap"] as MemeName[]) {
    const img = new Image();
    const url = `${base}meme/${name}.png`;
    img.onload = () => {
      // A static host that rewrites misses to index.html serves HTML with a
      // 200; an Image that decodes is the real test of existence.
      urls.set(name, url);
    };
    img.src = url;
  }
}

/** URL of a loaded asset, or null while the emoji placeholder should be used. */
export function memeAsset(name: MemeName): string | null {
  return urls.get(name) ?? null;
}

export const PLACEHOLDER: Record<Exclude<MemeName, "slap">, string> = {
  chad: "🗿",
  snowflake: "❄️",
};
