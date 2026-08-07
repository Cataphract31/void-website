import { useEffect, useRef, useState, type JSX } from "react";
import type { Snapshot } from "@/game/client";

/**
 * The heartbeat.
 *
 * The risk number used to be small grey text that nobody read. It is the
 * single most important quantity in the game — the chance your plate shatters
 * on the next tick — so it is now large, coloured, and attached to a sweep bar
 * that visibly races the clock between ticks. When the sweep lands, something
 * happens. That makes the pacing legible without anyone reading a tooltip.
 */
export function RiskBar({ snap, tickMs }: { snap: Snapshot; tickMs: number }): JSX.Element {
  const live = snap.phase === "live";
  const [pulse, setPulse] = useState(0);
  const lastTick = useRef(snap.tick);

  useEffect(() => {
    if (snap.tick !== lastTick.current) {
      lastTick.current = snap.tick;
      setPulse((p) => p + 1);
    }
  }, [snap.tick]);

  const risk = snap.hazard;
  const color = snap.grace
    ? "var(--color-cyan)"
    : risk > 0.055
      ? "var(--color-danger)"
      : risk > 0.02
        ? "var(--color-warn)"
        : "var(--color-cyan)";

  const label = snap.grace
    ? "LATTICE HOLDING"
    : risk > 0.055
      ? "CRITICAL"
      : risk > 0.02
        ? "STRESSED"
        : "STABLE";

  return (
    <div className="flex items-center gap-3 rounded-sm border border-[var(--color-edge)] bg-[var(--color-pit)]/80 px-3 py-2 backdrop-blur-sm">
      <div className="min-w-[104px]">
        <div className="label leading-[1.3]">
          your shatter
          <br />
          risk each tick
        </div>
        <div
          className="tnum leading-none"
          style={{ fontSize: 24, fontWeight: 700, color }}
        >
          {live ? `${(risk * 100).toFixed(1)}` : "—"}
          {live && <span style={{ fontSize: 13, opacity: 0.7 }}>%</span>}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="label" style={{ color }}>
            {live ? label : "offline"}
          </span>
          <span className="label tnum">{live ? `tick ${snap.tick}` : ""}</span>
        </div>

        {/* Sweep races the tick interval; the flash marks the moment it lands. */}
        <div className="relative h-2 overflow-hidden rounded-full bg-[var(--color-panel2)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-25"
            style={{
              width: `${Math.min(100, (risk / 0.14) * 100)}%`,
              background: color,
            }}
          />
          {live && (
            <div
              key={pulse}
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${color})`,
                animation: `sweep ${tickMs}ms linear`,
              }}
            />
          )}
        </div>
      </div>

      <div className="min-w-[74px] text-right">
        <div className="label leading-tight">still in</div>
        <div className="tnum leading-none" style={{ fontSize: 24, fontWeight: 700 }}>
          {snap.liveCount}
          <span className="text-[var(--color-dim)]" style={{ fontSize: 13 }}>
            /{snap.totalCount}
          </span>
        </div>
      </div>
    </div>
  );
}
