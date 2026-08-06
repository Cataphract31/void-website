import { useEffect, useRef, useState, type JSX } from "react";
import type { Snapshot } from "@/game/client";

/**
 * The hero.
 *
 * Every live player holds an identical balance, so there is exactly one
 * multiplier and the whole room shares it — the same legibility Bustabit gets
 * from its curve. The difference is that this one moves in hard steps, and
 * each step is paid for by someone who just died. So it jolts rather than
 * eases: the discontinuity is the point.
 */
export function Multiplier({ snap }: { snap: Snapshot }): JSX.Element {
  const [jolt, setJolt] = useState(0);
  const prev = useRef(snap.multiplier);
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    if (snap.phase !== "live") return;
    const d = snap.multiplier - prev.current;
    if (d > 0.0005) {
      setJolt((j) => j + 1);
      setDelta(d);
      const t = setTimeout(() => setDelta(null), 900);
      prev.current = snap.multiplier;
      return () => clearTimeout(t);
    }
    prev.current = snap.multiplier;
  }, [snap.multiplier, snap.phase]);

  const locked = snap.you.lockedMultiple;
  const live = snap.phase === "live";
  const inProfit = snap.multiplier >= 1;

  // Colour tracks the one thing that matters before profit: are you above water.
  const color = !live
    ? "var(--color-dim)"
    : inProfit
      ? "var(--color-profit)"
      : "var(--color-amber)";

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {live && snap.grace && (
        <div className="label mb-1 text-[var(--color-cyan)]">
          air holding · {snap.graceRemaining} tick{snap.graceRemaining === 1 ? "" : "s"}
        </div>
      )}

      <div className="relative">
        <div
          key={jolt}
          className={`tnum leading-none ${live ? "jolt" : ""}`}
          style={{
            fontSize: "clamp(56px, 17vw, 132px)",
            fontWeight: 700,
            color,
            textShadow: live
              ? `0 0 38px ${inProfit ? "rgba(95,209,141,0.28)" : "rgba(255,178,69,0.24)"}`
              : "none",
            letterSpacing: "-0.03em",
          }}
        >
          {snap.multiplier.toFixed(2)}
          <span style={{ fontSize: "0.44em", marginLeft: "0.04em", opacity: 0.75 }}>×</span>
        </div>

        {delta !== null && (
          <div
            className="tnum absolute -right-2 top-0 text-[var(--color-profit)]"
            style={{ fontSize: "clamp(13px,3.6vw,20px)", fontWeight: 600 }}
          >
            +{delta.toFixed(2)}
          </div>
        )}
      </div>

      {/* Break-even is a real event: it is the moment the rake is paid off. */}
      <div className="mt-1 h-4 text-center">
        {live && !inProfit && (
          <span className="label text-[var(--color-amber)]">
            {((1 - snap.multiplier) * 100).toFixed(0)}% to break even
          </span>
        )}
        {live && inProfit && (
          <span className="label text-[var(--color-profit)]">
            in profit · {((snap.multiplier - 1) * 100).toFixed(0)}% up
          </span>
        )}
        {!live && snap.phase === "result" && (
          <span className="label">best this round</span>
        )}
      </div>

      {/* Once you are out, your number freezes while the room's keeps moving. */}
      {locked !== null && (
        <div className="mt-2 flex items-center gap-2 rounded-sm border border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/8 px-3 py-1">
          <span className="label text-[var(--color-cyan)]">you banked</span>
          <span className="tnum text-[15px] font-semibold text-[var(--color-cyan)]">
            {locked.toFixed(2)}×
          </span>
        </div>
      )}
    </div>
  );
}
