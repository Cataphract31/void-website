import { useState, type JSX } from "react";
import type { Snapshot } from "@/game/client";
import {
  getVolume,
  initAudio,
  isMuted,
  loadMutePreference,
  setMuted,
  setVolume,
} from "@/audio/sound";

/**
 * Volume, not a mute toggle.
 *
 * On/off is a blunt instrument: a player who finds the game slightly too loud
 * has only the option of silence, so they take it and never turn it back on.
 * The speaker icon still mutes on click — that has to stay one tap — but the
 * slider is right there, and both persist.
 */
function VolumeControl(): JSX.Element {
  const [off, setOff] = useState(() => loadMutePreference());
  const [level, setLevel] = useState(() => getVolume());

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => {
          initAudio();
          const next = !isMuted();
          setMuted(next);
          setOff(next);
        }}
        aria-label={off ? "Unmute" : "Mute"}
        className="rounded-sm border border-[var(--color-edge2)] px-2 py-1 text-[13px] leading-none text-[var(--color-dim)] hover:text-[var(--color-text)]"
      >
        {off ? "\u{1F507}" : "\u{1F50A}"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={off ? 0 : level}
        aria-label="Volume"
        onChange={(e) => {
          initAudio();
          const v = Number(e.target.value);
          setVolume(v);
          setLevel(v);
          setOff(v === 0 || isMuted());
        }}
        className="hidden w-[62px] accent-[var(--color-cyan)] sm:block"
      />
    </div>
  );
}

export function TopBar({
  snap,
  onShowInfo,
}: {
  snap: Snapshot;
  onShowInfo: () => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="display text-[15px] font-bold tracking-[0.16em]">
        CRITICAL<span className="text-[var(--color-cyan)]">MASS</span>
      </div>
      <div className="label">#{snap.roundId}</div>
      <div className="ml-auto flex items-center gap-3">
        <div className="text-right">
          <div className="label">wallet</div>
          <div className="tnum text-[13px] font-semibold text-[var(--color-zinc-hi)]">
            {snap.wallet.toFixed(3)} ◎
          </div>
        </div>
        <div className="text-right">
          <div className="label">session</div>
          <div
            className="tnum text-[13px] font-semibold"
            style={{
              color: snap.session >= 0 ? "var(--color-profit)" : "var(--color-danger)",
            }}
          >
            {snap.session >= 0 ? "+" : ""}
            {snap.session.toFixed(3)} ◎
          </div>
        </div>
        <div className="text-right">
          <div className="label">tickets</div>
          <div className="tnum text-[13px] font-semibold">
            {/* Rev-share tickets never reset, so they run into five figures
                fast — grouped, or the number stops being readable. */}
            <span className="text-[var(--color-gold)]">
              {snap.bonanzaTickets.toLocaleString()}
            </span>
            <span className="text-[var(--color-dim)]"> / </span>
            <span className="text-[var(--color-cyan)]">
              {snap.revShareTickets.toLocaleString()}
            </span>
          </div>
        </div>
        <button
          onClick={onShowInfo}
          className="label rounded-sm border border-[var(--color-edge2)] px-2 py-1.5 text-[var(--color-dim)] hover:text-[var(--color-text)]"
        >
          how it works
        </button>
        <VolumeControl />
      </div>
    </div>
  );
}

export function BonanzaBar({ snap }: { snap: Snapshot }): JSX.Element {
  return (
    <div className="breathe mx-3 flex items-center gap-3 rounded-sm border border-[var(--color-gold)]/45 bg-gradient-to-r from-[#1b1608] to-[#0f1319] px-3 py-1.5">
      <span className="label text-[var(--color-gold)]">bonanza</span>
      <span className="tnum text-[17px] font-bold text-[var(--color-gold)]">
        {snap.bonanzaPool.toFixed(1)} ◎
      </span>
      <span className="label ml-auto hidden sm:inline">
        one ticket takes all
      </span>
    </div>
  );
}

export function ActionBar({
  snap,
  onJoin,
  onWalkOut,
}: {
  snap: Snapshot;
  onJoin: () => void;
  onWalkOut: () => void;
}): JSX.Element {
  const secs = Math.ceil(snap.msToPhaseEnd / 1000);
  let label = "";
  let action: (() => void) | null = null;
  let tone = "idle";

  if (snap.phase === "lobby") {
    if (snap.you.joined) {
      label = `Bonded — sealing in ${secs}s`;
    } else {
      label = `Bond in · 0.100 ◎`;
      action = onJoin;
      tone = "go";
    }
  } else if (snap.phase === "live") {
    if (snap.you.outcome === "in") {
      label = `Extract · ${snap.you.multiple.toFixed(2)}×`;
      action = onWalkOut;
      tone = "cash";
    } else if (snap.you.outcome === "cashed") {
      label = `Banked ${snap.you.multiple.toFixed(2)}×`;
    } else if (snap.you.outcome === "dead") {
      label = "Plate shattered";
    } else {
      label = "Spectating";
    }
  } else {
    label = `Next round in ${secs}s`;
  }

  const bg =
    tone === "go"
      ? "bg-[var(--color-cyan)] text-[#03211f]"
      : tone === "cash"
        ? "bg-[var(--color-profit)] text-[#03231a]"
        : "bg-[var(--color-panel2)] text-[var(--color-dim)]";

  return (
    <div className="border-t border-[var(--color-edge)] bg-[var(--color-pit)]/95 px-3 py-2.5 backdrop-blur">
      <button
        disabled={!action}
        onClick={action ?? undefined}
        className={`display h-13 w-full rounded-sm py-3.5 text-[17px] font-bold tracking-[0.1em] transition-transform active:scale-[0.985] disabled:cursor-not-allowed ${bg}`}
      >
        {label}
      </button>
    </div>
  );
}
