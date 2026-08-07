import { useState, type JSX } from "react";
import type { GameClient, Snapshot } from "@/game/client";
import {
  hasSample,
  sfxBonanza,
  sfxExtract,
  sfxJoin,
  sfxSeal,
  sfxShatter,
  sfxTick,
  sfxYouDied,
} from "@/audio/sound";

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

      {/* Visual risk chamber: force the displayed danger to audition the
          cracking/trembling/audio without waiting for a p99 endgame. Pair
          with "no deaths" for an indefinite round to stare at. */}
      <div className="mb-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="label">shown risk</span>
          <span className="tnum text-[11px]">
            {snap.dev.hazardOverride === null
              ? "real"
              : `${(snap.dev.hazardOverride * 100).toFixed(1)}%`}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {[null, 0.01, 0.02, 0.035, 0.05, 0.075, 0.12, 0.17].map((h) => (
            <button
              key={h ?? "off"}
              onClick={() => client.setDev({ hazardOverride: h })}
              className="label flex-1 rounded-sm border px-1 py-0.5"
              style={{
                borderColor:
                  snap.dev.hazardOverride === h
                    ? "var(--color-cyan)"
                    : "var(--color-edge2)",
                color: snap.dev.hazardOverride === h ? "var(--color-cyan)" : undefined,
              }}
            >
              {h === null ? "real" : `${h * 100}%`}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => client.setDev({ immortal: !snap.dev.immortal })}
        className="label mb-2 w-full rounded-sm border py-1.5"
        style={{
          borderColor: snap.dev.immortal ? "var(--color-cyan)" : "var(--color-edge2)",
          color: snap.dev.immortal ? "var(--color-cyan)" : undefined,
        }}
      >
        no deaths {snap.dev.immortal ? "on (next round)" : "off"}
      </button>

      <button
        onClick={() => client.skipPhase()}
        className="label mb-2 w-full rounded-sm border border-[var(--color-edge2)] py-1.5 hover:text-[var(--color-text)]"
      >
        skip to next phase
      </button>

      <button
        onClick={() => client.setDev({ memeMode: !snap.dev.memeMode })}
        className="label mb-2.5 w-full rounded-sm border py-1.5"
        style={{
          borderColor: snap.dev.memeMode ? "var(--color-cyan)" : "var(--color-edge2)",
          color: snap.dev.memeMode ? "var(--color-cyan)" : undefined,
        }}
      >
        meme mode {snap.dev.memeMode ? "on" : "off"}
      </button>

      <SoundTest />
    </div>
  );
}

/**
 * Audition every cue on demand.
 *
 * Judging audio by playing rounds until the right thing happens is hopeless,
 * and swapping in a sample pack needs a tight loop: drop the file in, click,
 * hear it. A dot marks cues that are being served from `public/sfx/` rather
 * than synthesised, so it is obvious whether a pack file was actually picked
 * up or quietly 404'd.
 */
function SoundTest(): JSX.Element {
  const cues: [string, string, () => void][] = [
    // Weighted toward 0.5-3%, which is where the hazard actually spends the
    // round. The two high steps only exist to check the opening spike.
    ["0.4%", "tick", () => sfxTick(0.004)],
    ["0.8%", "tick", () => sfxTick(0.008)],
    ["1.5%", "tick", () => sfxTick(0.015)],
    ["2.2%", "tick", () => sfxTick(0.022)],
    ["3%", "tick", () => sfxTick(0.03)],
    ["5%", "tick", () => sfxTick(0.05)],
    ["7.5%", "tick", () => sfxTick(0.075)],
    ["1 plate", "shatter", () => sfxShatter(1)],
    ["shatter_many", "shatter_many", () => sfxShatter(4)],
    ["you died", "died", sfxYouDied],
    ["extract", "extract", sfxExtract],
    ["seal", "seal", sfxSeal],
    ["join", "join", sfxJoin],
    ["bonanza", "bonanza", sfxBonanza],
  ];

  return (
    <div className="border-t border-[var(--color-edge)] pt-2">
      <div className="label mb-1.5 text-[var(--color-text)]">sound test</div>
      <div className="grid grid-cols-2 gap-1">
        {cues.map(([label, file, play]) => (
          <button
            key={label}
            onClick={play}
            className="label flex items-center gap-1 rounded-sm border border-[var(--color-edge2)] px-1.5 py-1 hover:text-[var(--color-text)]"
          >
            {hasSample(file) && (
              <span
                className="inline-block h-1 w-1 shrink-0 rounded-full"
                style={{ background: "var(--color-profit)" }}
              />
            )}
            {label}
          </button>
        ))}
      </div>
      <div className="label mt-1.5 leading-snug text-[var(--color-dim)]">
        dot = playing your file from public/sfx
      </div>
    </div>
  );
}
