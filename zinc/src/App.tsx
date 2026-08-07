import { useEffect, useState, type JSX } from "react";
import { getGameClient, type PlayerView, type Snapshot } from "@/game/client";
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
import { CharArt, CharSelect, ShatterCard, WinnerOverlay } from "@/ui/Chars";
import { initAudio } from "@/audio/sound";
import { charById, initCharAssets } from "@/game/chars";
import { initTileAssets } from "@/render/tiles";
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
  const [showChars, setShowChars] = useState(false);
  const [tab, setTab] = useState<"roster" | "history">("roster");

  useEffect(() => client.subscribe(setSnap), [client]);
  useEffect(() => {
    initCharAssets();
    initTileAssets();
  }, []);

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
      <TopBar
        snap={snap}
        onShowInfo={() => setShowInfo(true)}
        onShowChars={() => setShowChars(true)}
      />
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

          {/* Flat: the lattice reads as a surface, not a framed screenshot.
              Its darker pit background is the only separation it needs. */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm">
            <Shaft snap={snap} onSelectCell={setSelected} />

            {chosen && (
              <PlayerCard
                p={chosen}
                entry={snap.entry}
                onClose={() => setSelected(null)}
              />
            )}

            <ShatterCard snap={snap} />
            <WinnerOverlay snap={snap} />
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

      {/* Mobile panel. Kept deliberately short: on a phone every row of chrome
          is taken straight out of the lattice, which is the thing people came
          to look at. The roster scrolls, so height here is a luxury. */}
      <div className="mt-1.5 h-[148px] shrink-0 px-1.5 lg:hidden">
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
      {showChars && (
        <CharSelect
          snap={snap}
          onPick={(id) => client.setCharacter(id)}
          onClose={() => setShowChars(false)}
        />
      )}

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

      <Footer onShowInfo={() => setShowInfo(true)} />
    </div>
  );
}

/**
 * Slim anchor for the bottom of the page. Without it the layout just stops,
 * which reads as "did this fail to load" or "can I scroll"; with it the page
 * visibly ends on purpose.
 */
function Footer({ onShowInfo }: { onShowInfo: () => void }): JSX.Element {
  return (
    /* Hidden on phones: there the action bar already anchors the bottom of
       the page, and the footer would only cost the lattice another row. */
    <footer className="hidden shrink-0 items-center justify-between px-3 py-2 lg:flex">
      <span className="label">
        THIN<span className="text-[var(--color-cyan)]">ICE</span> · a zinc game
      </span>
      <span className="label flex items-center gap-3">
        <button onClick={onShowInfo} className="label hover:text-[var(--color-text)]">
          provably fair
        </button>
        <a
          href="https://zinc.cash"
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--color-text)]"
        >
          zinc.cash
        </a>
      </span>
    </footer>
  );
}

/**
 * Everything about one player on one plate.
 *
 * Tickets are worth showing even for a stranger: entry is fixed and tickets
 * are flat per entry, so the count is the same for everyone in the round and
 * the card can state it as fact rather than guessing. Fixed width with a
 * pinned close button, so the geometry never depends on the length of a name.
 */
function PlayerCard({
  p,
  entry,
  onClose,
}: {
  p: PlayerView;
  entry: number;
  onClose: () => void;
}): JSX.Element {
  const value = p.outcome === "dead" ? 0 : p.balance;
  const pl = value - entry;
  const tone =
    p.outcome === "dead"
      ? "var(--color-danger)"
      : p.outcome === "cashed"
        ? "var(--color-profit)"
        : "var(--color-text)";

  const line = (label: string, node: React.ReactNode): JSX.Element => (
    <div className="flex items-baseline justify-between gap-2">
      <span className="label">{label}</span>
      {node}
    </div>
  );

  return (
    <div className="absolute bottom-2 left-2 z-20 w-[208px] rounded-md bg-[var(--color-pit)]/95 p-2.5 shadow-[0_6px_28px_rgba(0,0,0,0.55)] backdrop-blur">
      <button
        onClick={onClose}
        aria-label="Close"
        className="label absolute right-2 top-2 text-[var(--color-dim)] hover:text-[var(--color-text)]"
      >
        ✕
      </button>

      <div className="flex items-center gap-2 pr-6">
        <CharArt charId={p.charId} pose="head" size={30} dim={p.outcome === "dead"} />
        <div className="min-w-0">
          <div
            className="truncate text-[12px] font-semibold"
            style={{ color: p.you ? "var(--color-cyan)" : "var(--color-text)" }}
          >
            {p.name}
          </div>
          <div className="label truncate">
            {charById(p.charId).label} ·{" "}
            {p.outcome === "dead"
              ? "shattered"
              : p.outcome === "cashed"
                ? "extracted"
                : "still in"}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="tnum text-[19px] font-bold" style={{ color: tone }}>
          {p.outcome === "dead" ? "0.00×" : `${p.multiple.toFixed(2)}×`}
        </span>
        <span className="tnum text-[11px]" style={{ color: tone }}>
          {value.toFixed(3)} ◎
        </span>
      </div>

      <div className="mt-2 space-y-0.5 border-t border-[var(--color-panel2)] pt-1.5">
        {line(
          "staked",
          <span className="tnum text-[11px]">{entry.toFixed(3)} ◎</span>,
        )}
        {line(
          p.outcome === "in" ? "unrealised" : "profit",
          <span
            className="tnum text-[11px] font-semibold"
            style={{
              color: pl >= 0 ? "var(--color-profit)" : "var(--color-danger)",
            }}
          >
            {pl >= 0 ? "+" : ""}
            {pl.toFixed(3)} ◎
          </span>,
        )}
        {line(
          "tickets",
          <span className="tnum text-[11px] font-semibold">
            <span className="text-[var(--color-gold)]">
              {DEFAULT_CONFIG.bonanza.ticketBase}
            </span>
            <span className="text-[var(--color-dim)]"> / </span>
            <span className="text-[var(--color-cyan)]">
              {DEFAULT_CONFIG.revShare.ticketsPerEntry}
            </span>
          </span>,
        )}
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
