import { useRef, type JSX } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LogEntry, PlayerView, Snapshot } from "@/game/client";

const KIND_COLOR: Record<LogEntry["kind"], string> = {
  join: "var(--color-dim)",
  seal: "var(--color-amber)",
  death: "var(--color-danger)",
  cash: "var(--color-profit)",
  you: "var(--color-cyan)",
  bonanza: "var(--color-gold)",
  info: "var(--color-dim)",
};

/** Rolling event feed. Virtualised so a thousand-player round stays smooth. */
export function Feed({ log }: { log: LogEntry[] }): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: log.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div className="relative w-full" style={{ height: virt.getTotalSize() }}>
        {virt.getVirtualItems().map((item) => {
          const e = log[item.index]!;
          return (
            <div
              key={e.id}
              className="absolute left-0 flex w-full items-baseline gap-2 px-1 text-[11.5px]"
              style={{ height: item.size, transform: `translateY(${item.start}px)` }}
            >
              <span className="truncate" style={{ color: KIND_COLOR[e.kind] }}>
                {e.text}
              </span>
              {e.value && (
                <span className="tnum ml-auto shrink-0 opacity-80" style={{ color: KIND_COLOR[e.kind] }}>
                  {e.value}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Who is still in, who got out, who did not. Sorted so the action is on top. */
export function Roster({ snap }: { snap: Snapshot }): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const rank = (p: PlayerView): number =>
    p.you ? 0 : p.outcome === "in" ? 1 : p.outcome === "cashed" ? 2 : 3;
  const rows = [...snap.players].sort(
    (a, b) => rank(a) - rank(b) || b.multiple - a.multiple,
  );

  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div className="relative w-full" style={{ height: virt.getTotalSize() }}>
        {virt.getVirtualItems().map((item) => {
          const p = rows[item.index]!;
          const color =
            p.outcome === "dead"
              ? "var(--color-danger)"
              : p.outcome === "cashed"
                ? "var(--color-profit)"
                : p.you
                  ? "var(--color-cyan)"
                  : "var(--color-text)";
          return (
            <div
              key={p.id}
              className="absolute left-0 flex w-full items-center gap-2 border-b border-[var(--color-edge)]/40 px-1 text-[11.5px]"
              style={{ height: item.size, transform: `translateY(${item.start}px)` }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: color,
                  opacity: p.outcome === "in" ? 1 : 0.45,
                }}
              />
              <span
                className="truncate"
                style={{
                  color: p.you ? "var(--color-cyan)" : "var(--color-text)",
                  opacity: p.outcome === "dead" ? 0.45 : 1,
                  fontWeight: p.you ? 600 : 400,
                }}
              >
                {p.name}
              </span>
              <span
                className="tnum ml-auto shrink-0"
                style={{
                  color,
                  opacity: p.outcome === "dead" ? 0.5 : 1,
                  textDecoration: p.outcome === "dead" ? "line-through" : "none",
                }}
              >
                {p.outcome === "dead" ? "0.00×" : `${p.multiple.toFixed(2)}×`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
