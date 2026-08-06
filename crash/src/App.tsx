import { useEffect, useState, type JSX, type ReactNode } from "react";
import { getGameClient, type Snapshot } from "@/game/client";
import { Shaft } from "@/ui/Shaft";
import { Multiplier } from "@/ui/Multiplier";
import { Feed, Roster } from "@/ui/Ledger";
import { ActionBar, AirGauge, BonanzaBar, TicketStrip, TopBar } from "@/ui/Hud";

export default function App(): JSX.Element {
  const client = getGameClient();
  const [snap, setSnap] = useState<Snapshot>(() => client.snapshot());
  const [tab, setTab] = useState<"feed" | "roster">("feed");

  // Only the subscription is tied to the component. The client owns its own
  // clock and keeps running, so a remount never stops the game.
  useEffect(() => client.subscribe(setSnap), [client]);

  return (
    <div className="mx-auto flex h-full max-w-[1180px] flex-col">
      <TopBar snap={snap} />
      <BonanzaBar snap={snap} />

      <div className="mt-2 flex min-h-0 flex-1 gap-2 px-0 lg:px-3">
        {/* Stage: canvas underneath, HUD floating above it. */}
        <div className="relative min-h-0 flex-1 overflow-hidden lg:rounded-sm lg:border lg:border-[var(--color-edge)]">
          <Shaft snap={snap} />

          <div className="pointer-events-none absolute inset-x-0 top-[6%] flex flex-col items-center">
            <Multiplier snap={snap} />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-2">
            <AirGauge snap={snap} />
          </div>

          {snap.phase === "lobby" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-12 text-center">
              <div className="label">
                {snap.totalCount} waiting · sealing in{" "}
                {Math.ceil(snap.msToPhaseEnd / 1000)}s
              </div>
            </div>
          )}
        </div>

        {/* Side rail on desktop. */}
        <aside className="hidden w-[300px] shrink-0 flex-col gap-2 lg:flex">
          <Panel title="Live feed">
            <Feed log={snap.log} />
          </Panel>
          <Panel title={`Shaft roster · ${snap.liveCount} in`}>
            <Roster snap={snap} />
          </Panel>
        </aside>
      </div>

      {/* Mobile: one panel with tabs, so the stage keeps the space. */}
      <div className="mt-2 h-[132px] shrink-0 px-2 lg:hidden">
        <div className="flex h-full flex-col rounded-sm border border-[var(--color-edge)] bg-[var(--color-panel)]">
          <div className="flex shrink-0 border-b border-[var(--color-edge)]">
            {(["feed", "roster"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="label px-3 py-1.5"
                style={{
                  color: tab === t ? "var(--color-text)" : "var(--color-dim)",
                  borderBottom:
                    tab === t ? "1px solid var(--color-amber)" : "1px solid transparent",
                }}
              >
                {t === "feed" ? "live feed" : `roster ${snap.liveCount}`}
              </button>
            ))}
            <div className="ml-auto flex items-center pr-2">
              <TicketStripCompact snap={snap} />
            </div>
          </div>
          <div className="min-h-0 flex-1 p-1">
            {tab === "feed" ? <Feed log={snap.log} /> : <Roster snap={snap} />}
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <TicketStrip snap={snap} />
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
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[var(--color-edge)] bg-[var(--color-panel)]">
      <div className="label shrink-0 border-b border-[var(--color-edge)] px-2 py-1.5">
        {title}
      </div>
      <div className="min-h-0 flex-1 p-1">{children}</div>
    </div>
  );
}

function TicketStripCompact({ snap }: { snap: Snapshot }): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="tnum font-semibold text-[var(--color-gold)]">
        {snap.bonanzaTickets}
      </span>
      <span className="label">bnz</span>
      <span className="tnum font-semibold text-[var(--color-cyan)]">
        {snap.revShareTickets}
      </span>
      <span className="label">rkb</span>
    </div>
  );
}
