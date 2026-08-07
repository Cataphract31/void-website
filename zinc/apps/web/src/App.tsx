import { useEffect, useRef, useState, type JSX } from "react";
import { getGameClient, type Snapshot } from "@/game/client";
import { Shaft } from "@/ui/Shaft";
import { Multiplier } from "@/ui/Multiplier";
import { Roster } from "@/ui/Ledger";
import { RiskBar } from "@/ui/RiskBar";
import { BonanzaOverlay } from "@/ui/Bonanza";
import { DevPanel } from "@/ui/DevPanel";
import { ActionBar, BonanzaBar, TopBar } from "@/ui/Hud";
import { initAudio } from "@/audio/sound";

const TICK_MS = 500;

export default function App(): JSX.Element {
  const client = getGameClient();
  const [snap, setSnap] = useState<Snapshot>(() => client.snapshot());
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => client.subscribe(setSnap), [client]);

  // Browsers block audio until the first gesture, so arm it on any interaction.
  useEffect(() => {
    const arm = (): void => initAudio();
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  const chosen = selected === null ? null : snap.players.find((p) => p.id === selected);

  return (
    <div className="mx-auto flex h-full max-w-[1180px] flex-col">
      <TopBar snap={snap} />
      <BonanzaBar snap={snap} />

      <div className="mt-1.5 flex min-h-0 flex-1 gap-2 px-1.5 lg:px-3">
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Reserved band. The multiplier lives in its own row rather than
              floating over the canvas, so it can never overlap the lattice. */}
          <div className="relative z-10 flex h-[128px] shrink-0 items-center justify-center sm:h-[150px]">
            <Multiplier snap={snap} />
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm border border-[var(--color-edge)]">
            <Shaft snap={snap} onSelectCell={setSelected} />

            {snap.phase === "lobby" && (
              <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
                <div className="rounded-sm border border-[var(--color-edge2)] bg-[var(--color-pit)]/90 px-3 py-1.5 text-center backdrop-blur">
                  <div className="display text-[13px] tracking-[0.14em] text-[var(--color-text)]">
                    {snap.totalCount} bonded
                  </div>
                  <div className="label mt-0.5 text-[var(--color-cyan)]">
                    sealing in {Math.ceil(snap.msToPhaseEnd / 1000)}s
                  </div>
                </div>
              </div>
            )}

            {chosen && (
              <div className="absolute bottom-2 left-2 z-20 rounded-sm border border-[var(--color-edge2)] bg-[var(--color-pit)]/95 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[12px] font-semibold"
                    style={{
                      color: chosen.you ? "var(--color-cyan)" : "var(--color-text)",
                    }}
                  >
                    {chosen.name}
                  </span>
                  <button
                    onClick={() => setSelected(null)}
                    className="label ml-2 text-[var(--color-dim)] hover:text-[var(--color-text)]"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span
                    className="tnum text-[17px] font-bold"
                    style={{
                      color:
                        chosen.outcome === "dead"
                          ? "var(--color-danger)"
                          : chosen.outcome === "cashed"
                            ? "var(--color-profit)"
                            : "var(--color-text)",
                    }}
                  >
                    {chosen.outcome === "dead" ? "0.00×" : `${chosen.multiple.toFixed(2)}×`}
                  </span>
                  <span className="label">
                    {chosen.outcome === "dead"
                      ? "shattered"
                      : chosen.outcome === "cashed"
                        ? "extracted"
                        : "still in"}
                  </span>
                </div>
              </div>
            )}

            <BonanzaOverlay event={snap.bonanza} />
            <DevPanel client={client} snap={snap} />
          </div>

          <div className="mt-1.5 shrink-0">
            <RiskBar snap={snap} tickMs={TICK_MS / snap.dev.speed} />
          </div>
        </div>

        {/* Desktop rail: roster only. */}
        <aside className="hidden w-[286px] shrink-0 lg:block">
          <Panel title={`Roster · ${snap.liveCount} in`}>
            <Roster snap={snap} onSelect={setSelected} />
          </Panel>
        </aside>
      </div>

      {/* Mobile roster, given real height now that the feed is gone. */}
      <div className="mt-1.5 h-[178px] shrink-0 px-1.5 lg:hidden">
        <Panel title={`Roster · ${snap.liveCount} in`}>
          <Roster snap={snap} onSelect={setSelected} />
        </Panel>
      </div>

      <ActionBar
        snap={snap}
        onJoin={() => client.join()}
        onWalkOut={() => client.walkOut()}
      />
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-sm border border-[var(--color-edge)] bg-[var(--color-panel)]">
      <div className="label shrink-0 border-b border-[var(--color-edge)] px-2 py-1.5">
        {title}
      </div>
      <div className="min-h-0 flex-1 p-1">{children}</div>
    </div>
  );
}
