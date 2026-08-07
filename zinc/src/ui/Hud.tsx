import { useEffect, useState, type JSX } from "react";
import type { AutoSettings, Snapshot } from "@/game/client";
import { shortAddress } from "@/game/names";
import { CharArt } from "./Chars";
import {
  getVolume,
  initAudio,
  isMuted,
  loadMutePreference,
  setMuted,
  setVolume,
} from "@/audio/sound";

/** Flat icon button shared by the top bar's controls. */
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="rounded-md px-2 py-1.5 text-[15px] leading-none text-[var(--color-dim)] hover:bg-[var(--color-panel2)] hover:text-[var(--color-text)]"
    >
      {children}
    </button>
  );
}

/**
 * Volume behind a popover instead of an always-visible slider.
 *
 * The inline slider was the thing pushing the top bar past the viewport on
 * mobile. The popover holds both controls — mute is one tap once it is open,
 * and the slider is still there so a player who finds the game slightly too
 * loud has a better option than silence. Both persist.
 */
function VolumePopover(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState(() => loadMutePreference());
  const [level, setLevel] = useState(() => getVolume());

  return (
    <div className="relative">
      <IconButton
        label="Sound"
        onClick={() => {
          initAudio();
          setOpen((o) => !o);
        }}
      >
        {off ? "\u{1F507}" : "\u{1F50A}"}
      </IconButton>

      {open && (
        <>
          {/* Click-away layer. Sits under the popover, over everything else. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-[196px] rounded-md bg-[var(--color-panel2)] p-3 shadow-[0_8px_30px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  const next = !isMuted();
                  setMuted(next);
                  setOff(next);
                }}
                aria-label={off ? "Unmute" : "Mute"}
                className="text-[15px] leading-none"
              >
                {off ? "\u{1F507}" : "\u{1F50A}"}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={off ? 0 : level}
                aria-label="Volume"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  setLevel(v);
                  setOff(v === 0 || isMuted());
                }}
                className="w-full accent-[var(--color-cyan)]"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** The slice of Phantom's injected API this button needs. */
type PhantomProvider = {
  isPhantom?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
};

function phantom(): PhantomProvider | null {
  const w = window as unknown as {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };
  const p = w.phantom?.solana ?? w.solana;
  return p?.isPhantom ? p : null;
}

/**
 * Real Phantom connect, no wallet library: the extension injects its API into
 * the page. For now the connection only proves the flow and shows the address;
 * balances stay in the demo wallet until the server and program land.
 */
function WalletButton(): JSX.Element {
  const [addr, setAddr] = useState<string | null>(null);

  // Reconnect silently if the player has approved this site before.
  useEffect(() => {
    phantom()
      ?.connect({ onlyIfTrusted: true })
      .then((r) => setAddr(r.publicKey.toString()))
      .catch(() => {});
  }, []);

  const click = async (): Promise<void> => {
    const p = phantom();
    if (!p) {
      window.open("https://phantom.app", "_blank", "noopener");
      return;
    }
    if (addr) {
      await p.disconnect().catch(() => {});
      setAddr(null);
      return;
    }
    try {
      const r = await p.connect();
      setAddr(r.publicKey.toString());
    } catch {
      // Player closed the Phantom prompt; nothing to do.
    }
  };

  return (
    <button
      onClick={click}
      className="label rounded-sm bg-[var(--color-panel2)] px-2.5 py-1.5 hover:text-[var(--color-text)]"
      style={addr ? { color: "var(--color-cyan)" } : undefined}
    >
      {addr ? shortAddress(addr) : "connect"}
    </button>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}): JSX.Element {
  return (
    <div className="text-right">
      <div className="label">{label}</div>
      <div className="tnum text-[13px] font-semibold" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

/**
 * The tickets stat opens the standings: what your tickets are worth right now
 * in both economies. This is the demo's showcase that holding pays — the rev
 * slice streams to you every round whether you entered it or not.
 */
function TicketsStat({ snap }: { snap: Snapshot }): JSX.Element {
  const [open, setOpen] = useState(false);
  const t = snap.tickets;
  const pct = (x: number): string =>
    x > 0 && x < 0.0001 ? "<0.01%" : `${(x * 100).toFixed(2)}%`;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="text-right">
        <div className="label">tickets</div>
        {/* Rev-share tickets never reset, so they run into five figures fast —
            grouped, or the number stops being readable. */}
        <div className="tnum text-[13px] font-semibold">
          <span className="text-[var(--color-gold)]">
            {snap.bonanzaTickets.toLocaleString()}
          </span>
          <span className="text-[var(--color-dim)]"> / </span>
          <span className="text-[var(--color-cyan)]">
            {snap.revShareTickets.toLocaleString()}
          </span>
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-[240px] rounded-md bg-[var(--color-panel2)] p-3 text-left shadow-[0_8px_30px_rgba(0,0,0,0.55)]">
            <div className="label text-[var(--color-gold)]">bonanza</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="tnum text-[12px] font-semibold">
                {t.bonYours.toLocaleString()}
                <span className="text-[var(--color-dim)]">
                  {" "}
                  / {t.bonTotal.toLocaleString()}
                </span>
              </span>
              <span className="tnum text-[12px] font-bold text-[var(--color-gold)]">
                {pct(t.bonShare)}
              </span>
            </div>
            <div className="mt-1 text-[10.5px] leading-snug text-[var(--color-dim)]">
              Your odds of taking the whole pool when it fires. Every entry earns
              tickets, all tickets wipe on a fire.
            </div>

            <div className="label mt-3 text-[var(--color-cyan)]">rev share</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="label">your slice</span>
              <span className="tnum text-[12px] font-bold text-[var(--color-cyan)]">
                {pct(t.revShare)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="label">streamed to you</span>
              <span className="tnum text-[12px] font-bold text-[var(--color-profit)]">
                +{t.revStreamed.toFixed(4)} ◎
              </span>
            </div>
            <div className="mt-1 text-[10.5px] leading-snug text-[var(--color-dim)]">
              2% of every entry streams to ticket holders, paid every round, even
              rounds you sit out. Newer tickets weigh more.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stats({ snap }: { snap: Snapshot }): JSX.Element {
  return (
    <>
      <Stat label="wallet" value={`${snap.wallet.toFixed(3)} ◎`} color="var(--color-zinc-hi)" />
      <Stat
        label="session"
        value={`${snap.session >= 0 ? "+" : ""}${snap.session.toFixed(3)} ◎`}
        color={snap.session >= 0 ? "var(--color-profit)" : "var(--color-danger)"}
      />
      <TicketsStat snap={snap} />
    </>
  );
}

/**
 * Two jobs, two rows on mobile: identity and controls on the first, money on
 * the second. On desktop everything fits one row. The old single-row layout
 * overflowed a phone screen sideways and left dead space under the spill.
 */
export function TopBar({
  snap,
  onShowInfo,
  onShowChars,
}: {
  snap: Snapshot;
  onShowInfo: () => void;
  onShowChars: () => void;
}): JSX.Element {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="display text-[15px] font-bold tracking-[0.16em]">
          THIN<span className="text-[var(--color-cyan)]">ICE</span>
        </div>
        <div className="label">#{snap.roundId}</div>

        {/* Desktop: stats inline. */}
        <div className="ml-auto hidden items-center gap-4 sm:flex">
          <Stats snap={snap} />
        </div>

        <div className="flex items-center gap-1 sm:ml-1 max-sm:ml-auto">
          <button
            onClick={onShowChars}
            aria-label="Choose character"
            className="rounded-md p-1 hover:bg-[var(--color-panel2)]"
          >
            <CharArt charId={snap.charId} pose="head" size={22} />
          </button>
          <WalletButton />
          <IconButton label="How it works" onClick={onShowInfo}>
            ⓘ
          </IconButton>
          <VolumePopover />
        </div>
      </div>

      {/* Mobile: stats get their own row instead of overflowing sideways. */}
      <div className="mt-1.5 flex items-center justify-between gap-3 sm:hidden">
        <Stats snap={snap} />
      </div>
    </div>
  );
}

/**
 * Bustabit-style auto play: enter every round, extract at a target multiple.
 * The exit fires the tick the multiple crosses the target, banking whatever
 * the crossing value actually is: never under the target, sometimes above.
 */
export function AutoPanel({
  snap,
  onChange,
}: {
  snap: Snapshot;
  onChange: (patch: Partial<AutoSettings>) => void;
}): JSX.Element {
  const on = snap.auto.enabled;
  return (
    <div className="flex items-center gap-2 rounded-md bg-[var(--color-panel)] px-2.5 py-2">
      <button
        onClick={() => onChange({ enabled: !on })}
        className="label rounded-sm px-2.5 py-1.5"
        style={{
          background: on ? "var(--color-cyan)" : "var(--color-panel2)",
          color: on ? "#03211f" : undefined,
          fontWeight: on ? 700 : 500,
        }}
      >
        auto {on ? "on" : "off"}
      </button>
      <span className="label ml-auto">exit at</span>
      <input
        type="number"
        min={1.05}
        step={0.05}
        value={snap.auto.target}
        onChange={(e) => onChange({ target: Number(e.target.value) })}
        aria-label="Auto exit target"
        className="tnum w-[64px] rounded-sm bg-[var(--color-panel2)] px-1.5 py-1 text-right text-[13px] font-semibold text-[var(--color-text)] outline-none focus:ring-1 focus:ring-[var(--color-cyan)]"
      />
      <span className="label">×</span>
    </div>
  );
}

export function BonanzaBar({ snap }: { snap: Snapshot }): JSX.Element {
  return (
    <div className="breathe mx-3 flex items-center gap-3 rounded-sm bg-gradient-to-r from-[#1b1608] to-[#0f1319] px-3 py-1.5">
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

export function ActionBar({
  snap,
  onJoin,
  onWalkOut,
  inline = false,
}: {
  snap: Snapshot;
  onJoin: () => void;
  onWalkOut: () => void;
  /** In-column placement (desktop) instead of the full-width bottom bar. */
  inline?: boolean;
}): JSX.Element {
  const secs = Math.ceil(snap.msToPhaseEnd / 1000);
  let label = "";
  let action: (() => void) | null = null;
  let tone = "idle";

  if (snap.phase === "lobby") {
    if (snap.you.joined) {
      label = `Bonded, sealing in ${secs}s`;
    } else {
      label = `Bond in · ${snap.entry.toFixed(3)} ◎`;
      action = onJoin;
      tone = "go";
    }
  } else if (snap.phase === "live") {
    if (snap.you.outcome === "in") {
      label = `Extract · ${snap.you.multiple.toFixed(2)}×`;
      action = onWalkOut;
      tone = "cash";
    } else if (snap.you.outcome === "cashed") {
      label = `Banked ${snap.you.multiple.toFixed(2)}×`;
    } else if (snap.you.outcome === "dead") {
      label = "Plate shattered";
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

  const button = (
    <button
      disabled={!action}
      onClick={action ?? undefined}
      className={`display h-13 w-full rounded-sm py-3.5 text-[17px] font-bold tracking-[0.1em] transition-transform active:scale-[0.985] disabled:cursor-not-allowed ${bg}`}
    >
      {label}
    </button>
  );

  if (inline) return button;
  return <div className="bg-[var(--color-pit)]/95 px-3 py-2.5 backdrop-blur">{button}</div>;
}
