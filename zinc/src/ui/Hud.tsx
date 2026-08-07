import { useState, type JSX } from "react";
import type { AutoSettings, Snapshot } from "@/game/client";
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

function Stats({ snap }: { snap: Snapshot }): JSX.Element {
  return (
    <>
      <Stat label="wallet" value={`${snap.wallet.toFixed(3)} ◎`} color="var(--color-zinc-hi)" />
      <Stat
        label="session"
        value={`${snap.session >= 0 ? "+" : ""}${snap.session.toFixed(3)} ◎`}
        color={snap.session >= 0 ? "var(--color-profit)" : "var(--color-danger)"}
      />
      {/* Rev-share tickets never reset, so they run into five figures fast —
          grouped, or the number stops being readable. */}
      <div className="text-right">
        <div className="label">tickets</div>
        <div className="tnum text-[13px] font-semibold">
          <span className="text-[var(--color-gold)]">
            {snap.bonanzaTickets.toLocaleString()}
          </span>
          <span className="text-[var(--color-dim)]"> / </span>
          <span className="text-[var(--color-cyan)]">
            {snap.revShareTickets.toLocaleString()}
          </span>
        </div>
      </div>
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
}: {
  snap: Snapshot;
  onShowInfo: () => void;
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

        <div className="flex items-center gap-0.5 sm:ml-1 max-sm:ml-auto">
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
    <div className="breathe mx-3 flex items-center gap-3 rounded-sm border border-[var(--color-gold)]/45 bg-gradient-to-r from-[#1b1608] to-[#0f1319] px-3 py-1.5">
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
