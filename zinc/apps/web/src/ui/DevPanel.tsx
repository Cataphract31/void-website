import { useState, type JSX } from "react";
import type { GameClient, Snapshot } from "@/game/client";

/**
 * Testing controls. Not part of the player-facing product — this exists so the
 * jackpot, the crowd at scale, and the pacing can all be exercised on demand
 * instead of waiting 1500 rounds for the interesting one.
 */
export function DevPanel({
  client,
  snap,
}: {
  client: GameClient;
  snap: Snapshot;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="label absolute right-2 top-2 z-20 rounded-sm border border-[var(--color-edge2)] bg-[var(--color-pit)]/85 px-2 py-1 text-[var(--color-dim)] backdrop-blur hover:text-[var(--color-text)]"
      >
        dev
      </button>
    );
  }

  const field = snap.dev.fieldSize;

  return (
    <div className="absolute right-2 top-2 z-20 w-[228px] rounded-sm border border-[var(--color-edge2)] bg-[var(--color-pit)]/95 p-2.5 backdrop-blur">
      <div className="mb-2 flex items-center">
        <span className="label text-[var(--color-text)]">test controls</span>
        <button
          onClick={() => setOpen(false)}
          className="label ml-auto text-[var(--color-dim)] hover:text-[var(--color-text)]"
        >
          close
        </button>
      </div>

      <button
        onClick={() => client.triggerBonanza()}
        className="display mb-2 w-full rounded-sm bg-[var(--color-gold)] py-2 text-[13px] font-bold tracking-[0.1em] text-[#2a1a00] active:scale-[0.98]"
      >
        fire bonanza now
      </button>
      <div className="label mb-2.5 leading-snug text-[var(--color-dim)]">
        fires at the end of the current round
      </div>

      <div className="mb-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="label">field size</span>
          <span className="tnum text-[11px]">{field ?? "random 18-34"}</span>
        </div>
        <input
          type="range"
          min={2}
          max={400}
          step={1}
          value={field ?? 26}
          onChange={(e) => client.setDev({ fieldSize: Number(e.target.value) })}
          className="w-full accent-[var(--color-cyan)]"
        />
        <div className="mt-1 flex gap-1">
          {[6, 30, 120, 400].map((n) => (
            <button
              key={n}
              onClick={() => client.setDev({ fieldSize: n })}
              className="label flex-1 rounded-sm border border-[var(--color-edge2)] py-0.5 hover:text-[var(--color-text)]"
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => client.setDev({ fieldSize: null })}
            className="label flex-1 rounded-sm border border-[var(--color-edge2)] py-0.5 hover:text-[var(--color-text)]"
          >
            auto
          </button>
        </div>
        <div className="label mt-1 leading-snug text-[var(--color-dim)]">
          applies from the next round
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="label">tick speed</span>
          <span className="tnum text-[11px]">{snap.dev.speed}×</span>
        </div>
        <div className="flex gap-1">
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => client.setDev({ speed: s })}
              className="label flex-1 rounded-sm border py-0.5"
              style={{
                borderColor:
                  snap.dev.speed === s ? "var(--color-cyan)" : "var(--color-edge2)",
                color: snap.dev.speed === s ? "var(--color-cyan)" : undefined,
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => client.skipPhase()}
        className="label w-full rounded-sm border border-[var(--color-edge2)] py-1.5 hover:text-[var(--color-text)]"
      >
        skip to next phase
      </button>
    </div>
  );
}
