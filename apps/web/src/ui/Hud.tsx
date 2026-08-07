import type { JSX } from "react";
import type { Snapshot } from "@/game/client";

export function TopBar({ snap }: { snap: Snapshot }): JSX.Element {
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

/**
 * Air quality. This doubles as the risk readout: the scene grades to the same
 * colour, so the number and the atmosphere always agree.
 */
export function AirGauge({ snap }: { snap: Snapshot }): JSX.Element {
  const pct = Math.min(100, (snap.hazard / 0.16) * 100);
  const color =
    snap.hazard > 0.05
      ? "var(--color-danger)"
      : snap.hazard > 0.018
        ? "var(--color-warn)"
        : "var(--color-cyan)";
  const live = snap.phase === "live";

  return (
    <div className="flex items-center gap-3 px-3">
      <div className="min-w-[74px]">
        <div className="label">co₂ / tick</div>
        <div className="tnum text-[15px] font-semibold" style={{ color }}>
          {live ? `${(snap.hazard * 100).toFixed(1)}%` : "—"}
        </div>
      </div>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-panel2)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{
            width: `${live ? pct : 0}%`,
            background: `linear-gradient(90deg, var(--color-cyan), var(--color-warn) 52%, var(--color-danger))`,
          }}
        />
      </div>
      <div className="min-w-[86px] text-right">
        <div className="label">still inside</div>
        <div className="tnum text-[15px] font-semibold text-[var(--color-text)]">
          {snap.liveCount}
          <span className="text-[var(--color-dim)]">/{snap.totalCount}</span>
        </div>
      </div>
    </div>
  );
}

export function TicketStrip({ snap }: { snap: Snapshot }): JSX.Element {
  return (
    <div className="flex items-center gap-4 px-3 py-1.5 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="label">bonanza tickets</span>
        <span className="tnum font-semibold text-[var(--color-gold)]">
          {snap.bonanzaTickets}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="label">rakeback</span>
        <span className="tnum font-semibold text-[var(--color-cyan)]">
          {snap.revShareTickets}
        </span>
      </div>
      <span className="label ml-auto hidden md:inline">1 of each per round played</span>
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
      label = `You're in — sealing in ${secs}s`;
    } else {
      label = `Enter the shaft · 0.100 ◎`;
      action = onJoin;
      tone = "go";
    }
  } else if (snap.phase === "live") {
    if (snap.you.outcome === "in") {
      label = `Climb out · ${snap.you.multiple.toFixed(2)}×`;
      action = onWalkOut;
      tone = "cash";
    } else if (snap.you.outcome === "cashed") {
      label = `Banked ${snap.you.multiple.toFixed(2)}×`;
    } else if (snap.you.outcome === "dead") {
      label = "Taken by the shaft";
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
