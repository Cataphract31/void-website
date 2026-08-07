import { useEffect, useState, type JSX } from "react";
import { getGameClient, type Snapshot } from "@/game/client";
import { Shaft } from "@/ui/Shaft";
import { Multiplier } from "@/ui/Multiplier";
import { Roster } from "@/ui/Ledger";
import { HistoryPanel } from "@/ui/History";
import { TickRing } from "@/ui/TickRing";
import { BonanzaOverlay } from "@/ui/Bonanza";
import { DevPanel } from "@/ui/DevPanel";
import { ActionBar, AutoPanel, BonanzaBar, TopBar } from "@/ui/Hud";
import { InfoOverlay } from "@/ui/Info";
import { Tutorial, tutorialSeen } from "@/ui/Tutorial";
import { SlapOverlay } from "@/ui/Meme";
import { initAudio } from "@/audio/sound";
import { initMemeAssets } from "@/game/meme";
import { DEFAULT_CONFIG } from "@zinc/engine";

// Read from the engine, not restated. A second copy of the tick interval means
// the ring animation silently races the wrong clock the moment timing changes.
const TICK_MS = DEFAULT_CONFIG.timing.tickMs;

export default function App(): JSX.Element {
  const client = getGameClient();
  const [snap, setSnap] = useState<Snapshot>(() => client.snapshot());
  const [selected, setSelected] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showIntro, setShowIntro] = useState(() => !tutorialSeen());
  const [tab, setTab] = useState<"roster" | "history">("roster");

  useEffect(() => client.subscribe(setSnap), [client]);
  useEffect(() => initMemeAssets(), []);

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
      <TopBar snap={snap} onShowInfo={() => setShowInfo(true)} />
      <BonanzaBar snap={snap} />

      <div className="mt-1.5 flex min-h-0 flex-1 gap-2 px-1.5 lg:px-3">
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* The vitals strip. Everything a player must not miss lives here,
              above the lattice: the tick/danger ring, the hero multiplier, and
              the field count. The old placement — multiplier floating on the
              canvas, risk relegated to a thin bar below it — left the single
              most important quantity in the game unread. */}
          <div className="mb-1.5 flex shrink-0 items-stretch gap-2">
            <TickRing snap={snap} tickMs={TICK_MS / snap.dev.speed} />
            <div className="flex min-w-0 flex-1 items-center justify-center">
              <Multiplier snap={snap} />
            </div>
            <AliveCard snap={snap} />
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm border border-[var(--color-edge)]">
            <Shaft snap={snap} onSelectCell={setSelected} />

            {chosen && (
              /* Fixed width and a pinned close button: the card's geometry
                 never depends on how long the player's name happens to be. */
              <div className="absolute bottom-2 left-2 z-20 w-[196px] rounded-md bg-[var(--color-pit)]/95 p-2.5 shadow-[0_6px_28px_rgba(0,0,0,0.55)] backdrop-blur">
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="label absolute right-2 top-2 text-[var(--color-dim)] hover:text-[var(--color-text)]"
                >
                  ✕
                </button>
                <div
                  className="truncate pr-6 text-[12px] font-semibold"
                  style={{
                    color: chosen.you ? "var(--color-cyan)" : "var(--color-text)",
                  }}
                >
                  {chosen.name}
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

            <SlapOverlay snap={snap} />
            <BonanzaOverlay event={snap.bonanza} />
            {import.meta.env.DEV && <DevPanel client={client} snap={snap} />}
          </div>
        </div>

        {/* Desktop rail: your controls on top, at eye level with the game,
            the way every crash game places its bet panel. */}
        <aside className="hidden w-[286px] shrink-0 lg:flex lg:flex-col lg:gap-1.5">
          <ActionBar
            inline
            snap={snap}
            onJoin={() => client.join()}
            onWalkOut={() => client.walkOut()}
          />
          <AutoPanel snap={snap} onChange={(p) => client.setAuto(p)} />
          <div className="min-h-0 flex-1">
            <TabbedPanel snap={snap} tab={tab} onTab={setTab}>
              {tab === "roster" ? (
                <Roster snap={snap} onSelect={setSelected} />
              ) : (
                <HistoryPanel snap={snap} client={client} />
              )}
            </TabbedPanel>
          </div>
        </aside>
      </div>

      {/* Mobile panel, given real height now that the feed is gone. */}
      <div className="mt-1.5 h-[178px] shrink-0 px-1.5 lg:hidden">
        <TabbedPanel snap={snap} tab={tab} onTab={setTab}>
          {tab === "roster" ? (
            <Roster snap={snap} onSelect={setSelected} />
          ) : (
            <HistoryPanel snap={snap} client={client} />
          )}
        </TabbedPanel>
      </div>

      {showInfo && (
        <InfoOverlay
          onClose={() => setShowInfo(false)}
          onReplayIntro={() => {
            setShowInfo(false);
            setShowIntro(true);
          }}
        />
      )}
      {showIntro && <Tutorial onClose={() => setShowIntro(false)} />}

      {/* Mobile keeps the thumb-reach bottom bar, with auto play just above. */}
      <div className="lg:hidden">
        <div className="px-3 pb-1.5">
          <AutoPanel snap={snap} onChange={(p) => client.setAuto(p)} />
        </div>
        <ActionBar
          snap={snap}
          onJoin={() => client.join()}
          onWalkOut={() => client.walkOut()}
        />
      </div>
    </div>
  );
}

/**
 * Field count, and the one number that matters for the current phase: how many
 * are bonded and when the round seals, how many are still alive and what the
 * pot is, or how long until the next round.
 */
function AliveCard({ snap }: { snap: Snapshot }): JSX.Element {
  const secs = Math.ceil(snap.msToPhaseEnd / 1000);

  let label: string;
  let big: JSX.Element;
  let sub: string;

  if (snap.phase === "lobby") {
    label = "bonded";
    big = <>{snap.totalCount}</>;
    sub = `seals ${secs}s`;
  } else if (snap.phase === "live") {
    label = "alive";
    big = (
      <>
        {snap.liveCount}
        <span className="text-[var(--color-dim)]" style={{ fontSize: 13 }}>
          /{snap.totalCount}
        </span>
      </>
    );
    sub = `pot ${snap.potInPlay.toFixed(1)} ◎`;
  } else {
    label = "next round";
    big = <span className="text-[var(--color-dim)]">{secs}s</span>;
    sub = "";
  }

  return (
    <div className="flex w-[88px] shrink-0 flex-col items-center justify-center rounded-md bg-[var(--color-panel)] p-2 sm:w-[118px]">
      <div className="label">{label}</div>
      <div className="tnum mt-1 leading-none" style={{ fontSize: 26, fontWeight: 700 }}>
        {big}
      </div>
      <div className="label tnum mt-1.5 h-3">{sub}</div>
    </div>
  );
}

/** Flat surface, no frame: the lattice keeps the product's one border. */
function TabbedPanel({
  snap,
  tab,
  onTab,
  children,
}: {
  snap: Snapshot;
  tab: "roster" | "history";
  onTab: (t: "roster" | "history") => void;
  children: React.ReactNode;
}): JSX.Element {
  const tabBtn = (id: "roster" | "history", label: string): JSX.Element => (
    <button
      onClick={() => onTab(id)}
      className="label rounded-sm px-2 py-1"
      style={{
        color: tab === id ? "var(--color-text)" : undefined,
        background: tab === id ? "var(--color-panel2)" : undefined,
      }}
    >
      {label}
    </button>
  );
  return (
    <div className="flex h-full min-h-0 flex-col rounded-md bg-[var(--color-panel)]">
      <div className="flex shrink-0 items-center gap-1 px-1 pt-1">
        {tabBtn("roster", `roster · ${snap.liveCount} in`)}
        {tabBtn("history", "history")}
      </div>
      <div className="min-h-0 flex-1 p-1">{children}</div>
    </div>
  );
}
