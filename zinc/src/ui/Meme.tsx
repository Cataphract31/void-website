import { type JSX } from "react";
import type { Snapshot } from "@/game/client";
import { memeAsset, PLACEHOLDER } from "@/game/meme";

/**
 * A player's head in the roster: chad while they stand, snowflake once the
 * ice takes them. Falls back to emoji until real art lands in public/meme/.
 */
export function Head({
  outcome,
  size = 15,
}: {
  outcome: "in" | "cashed" | "dead";
  size?: number;
}): JSX.Element {
  const name = outcome === "dead" ? "snowflake" : "chad";
  const url = memeAsset(name);

  if (url) {
    return (
      <img
        src={url}
        width={size}
        height={size}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{
          filter:
            outcome === "dead"
              ? "grayscale(0.5) brightness(0.85)"
              : outcome === "cashed"
                ? "brightness(1.05)"
                : undefined,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="shrink-0 select-none leading-none"
      style={{ fontSize: size - 2, opacity: outcome === "dead" ? 0.75 : 1 }}
    >
      {PLACEHOLDER[name]}
    </span>
  );
}

/**
 * The end-of-round beat: chad swings in and the snowflake leaves the screen.
 * A `slap.png` in public/meme/ replaces the emoji scene wholesale. Keyed by
 * round so it plays exactly once per result phase, and it stays out of the
 * way of the (much rarer, much louder) bonanza overlay.
 */
export function SlapOverlay({ snap }: { snap: Snapshot }): JSX.Element | null {
  if (!snap.dev.memeMode || snap.phase !== "result" || snap.bonanza) return null;

  const art = memeAsset("slap");

  return (
    <div
      key={snap.roundId}
      className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center"
    >
      {art ? (
        <img src={art} alt="" className="slap-chad h-[96px] w-auto" />
      ) : (
        <div className="relative h-[88px] w-[230px]">
          <span className="slap-victim absolute bottom-0 left-[30%] text-[54px] leading-none">
            {PLACEHOLDER.snowflake}
          </span>
          <span className="slap-chad absolute bottom-0 right-[10%] text-[62px] leading-none">
            {PLACEHOLDER.chad}
          </span>
          <span className="slap-pow display absolute left-[22%] top-0 text-[15px] tracking-[0.2em] text-[var(--color-cyan)]">
            SLAP
          </span>
        </div>
      )}
    </div>
  );
}
