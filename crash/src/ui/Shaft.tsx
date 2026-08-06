import { useEffect, useRef, type JSX } from "react";
import { ShaftRenderer } from "@/render/shaft";
import type { Snapshot } from "@/game/client";
import type { FigureState } from "@/render/atlas";

/** Canvas host. React owns nothing inside here — the renderer runs its own loop. */
export function Shaft({ snap }: { snap: Snapshot }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ShaftRenderer | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const r = new ShaftRenderer(canvas);
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
      figures: snap.players.map((p) => ({
        id: p.id,
        state: (p.you
          ? p.outcome === "in"
            ? "you"
            : p.outcome === "cashed"
              ? "cashed"
              : "dying"
          : p.outcome === "in"
            ? "alive"
            : p.outcome === "cashed"
              ? "cashed"
              : "dying") as FigureState,
      })),
      hazard: snap.hazard,
      grace: snap.grace,
      phase: snap.phase,
    });
  }, [snap]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
