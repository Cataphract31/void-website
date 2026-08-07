import { type JSX } from "react";
import type { Snapshot } from "@/game/client";
import { CHARACTERS, charById, charImage, type Pose } from "@/game/chars";

/**
 * A character rendered at any size: real art when it exists in public/chars/,
 * otherwise the emoji placeholder on a hue-tinted disc so the layout and the
 * feature are judgeable before a single asset lands.
 */
export function CharArt({
  charId,
  pose,
  size,
  dim = false,
}: {
  charId: string;
  pose: Pose;
  size: number;
  dim?: boolean;
}): JSX.Element {
  const def = charById(charId);
  const img = charImage(def.id, pose);

  if (img) {
    return (
      <img
        src={img.src}
        width={size}
        height={size}
        alt={def.label}
        className="shrink-0 select-none object-contain"
        style={{
          // Pixel art must scale crunchy, never smoothed into mush.
          imageRendering: "pixelated",
          filter: dim ? "grayscale(0.6) brightness(0.8)" : undefined,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 select-none items-center justify-center rounded-full leading-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.62,
        background: `hsl(${def.hue} 45% 22% / ${dim ? 0.4 : 0.85})`,
        filter: dim ? "grayscale(0.6) brightness(0.8)" : undefined,
      }}
    >
      {def.emoji}
    </span>
  );
}

/** Roster-row head: the player's character, dimmed once the ice takes them. */
export function CharHead({
  charId,
  outcome,
  size = 18,
}: {
  charId: string;
  outcome: "in" | "cashed" | "dead";
  size?: number;
}): JSX.Element {
  return <CharArt charId={charId} pose="head" size={size} dim={outcome === "dead"} />;
}

/** Full-screen character select. Picking closes it. */
export function CharSelect({
  snap,
  onPick,
  onClose,
}: {
  snap: Snapshot;
  onPick: (id: string) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-md bg-[var(--color-panel)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <span className="display text-[13px] font-bold tracking-[0.14em]">
            choose your fighter
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="label text-[var(--color-dim)] hover:text-[var(--color-text)]"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-3">
          {CHARACTERS.map((c) => {
            const active = snap.charId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  onPick(c.id);
                  onClose();
                }}
                className="flex flex-col items-center gap-2 rounded-md p-3"
                style={{
                  background: active ? "var(--color-panel2)" : undefined,
                  boxShadow: active ? "inset 0 0 0 1.5px var(--color-cyan)" : undefined,
                }}
              >
                <CharArt charId={c.id} pose="head" size={52} />
                <span
                  className="label"
                  style={active ? { color: "var(--color-cyan)" } : undefined}
                >
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="label mt-3 text-center">purely cosmetic, same odds for all</div>
      </div>
    </div>
  );
}

/**
 * The round-end scene: an arcade winner screen over the lattice. The last one
 * standing gets top billing in their victory pose; the fallen line up small in
 * defeat along the bottom. A total wipe gets its own card, because "the ice
 * took everyone" is the house's victory screen.
 */
export function WinnerOverlay({ snap }: { snap: Snapshot }): JSX.Element | null {
  if (snap.phase !== "result" || snap.bonanza) return null;

  const w = snap.winner;
  // The bottom strip is the record, not the wreckage: recent round winners,
  // newest first, the running "which team is dominant" ticker.
  const champs = snap.history.filter((h) => h.winnerChar).slice(0, 8);

  return (
    <div
      key={snap.roundId}
      className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden"
    >
      {/* CRT dressing: darkened lattice, scanlines, one opening flash. */}
      <div className="scanlines absolute inset-0 bg-[var(--color-pit)]/82" />
      <div className="win-flash absolute inset-0 bg-white/70" />

      {w ? (
        <div className="relative flex flex-col items-center">
          <div className="win-slam">
            <CharArt charId={w.charId} pose="win" size={168} />
          </div>
          <div
            className="display win-rise mt-3 text-[15px] font-bold tracking-[0.22em]"
            style={{ color: w.you ? "var(--color-cyan)" : "var(--color-text)" }}
          >
            {w.lastStanding ? "last one standing" : "best extraction"}
          </div>
          <div className="win-rise mt-1 flex items-baseline gap-2.5">
            <span
              className="text-[13px] font-semibold"
              style={{ color: w.you ? "var(--color-cyan)" : "var(--color-text)" }}
            >
              {w.you ? "YOU" : w.name}
            </span>
            <span className="tnum text-[17px] font-bold text-[var(--color-profit)]">
              {w.multiple.toFixed(2)}×
            </span>
            <span className="tnum label">{w.amount.toFixed(3)} ◎</span>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center">
          <div className="win-slam text-[64px] leading-none">❄️</div>
          <div className="display win-rise mt-3 text-[15px] font-bold tracking-[0.22em] text-[var(--color-danger)]">
            the ice took everyone
          </div>
        </div>
      )}

      {champs.length > 1 && (
        <div className="win-rise relative mt-6 flex flex-col items-center gap-1.5">
          <span className="label">recent champions</span>
          <div className="flex items-center gap-1.5">
            {champs.map((h) => (
              <CharArt
                key={h.roundId}
                charId={h.winnerChar!}
                pose="head"
                size={24}
                dim={!h.winnerYou}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
