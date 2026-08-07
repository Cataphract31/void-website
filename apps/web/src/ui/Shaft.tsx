import { useEffect, useRef, type JSX } from "react";
import { LatticeRenderer } from "@/render/lattice";
import type { Snapshot } from "@/game/client";
import type { CellState } from "@/render/cells";

/** Canvas host. React owns nothing inside here — the renderer runs its own loop. */
export function Shaft({ snap }: { snap: Snapshot }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<LatticeRenderer | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const r = new LatticeRenderer(canvas);
    renderer.current = r;
    r.start();

    const ro = new ResizeObserver(() => r.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      r.stop();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    r.update({
      cells: snap.players.map((p) => ({
        id: p.id,
        state: (p.outcome === "dead"
          ? "dying"
          : p.outcome === "cashed"
            ? "cashed"
            : p.you
              ? "you"
              : "live") as CellState,
      })),
      hazard: snap.hazard,
      grace: snap.grace,
      phase: snap.phase,
    });
  }, [snap]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
