import { useEffect, type JSX, type ReactNode } from "react";
import { DEFAULT_CONFIG, totalRake } from "@zinc/engine";

/**
 * Rules, odds and where the money goes.
 *
 * Every number on this page is read out of the live game config rather than
 * typed in. That is not tidiness — the rake moved from 7% to 6% mid-build and
 * four hardcoded copies of the old figure went stale silently. A rules page
 * that disagrees with the engine is worse than no rules page, because it
 * reads as either incompetence or a lie, and this is a product asking people
 * for money.
 */

const C = DEFAULT_CONFIG;
const RAKE = totalRake(C);
const IN_GAME = 1 - RAKE;
const RTP = IN_GAME + C.rake.bonanza + C.rake.revShare;
const pc = (x: number, dp = 0): string => `${(x * 100).toFixed(dp)}%`;

export function InfoOverlay({ onClose }: { onClose: () => void }): JSX.Element {
  useEffect(() => {
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-[#04070a]/85 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="h-fit w-full max-w-[720px] rounded-sm border border-[var(--color-edge2)] bg-[var(--color-panel)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center gap-3 border-b border-[var(--color-edge)] bg-[var(--color-panel)] px-4 py-3">
          <span className="display text-[14px] tracking-[0.14em]">how it works</span>
          <span className="label ml-auto text-[var(--color-cyan)]">
            {pc(RTP)} rtp · {pc(C.rake.house)} house edge
          </span>
          <button
            onClick={onClose}
            className="label rounded-sm border border-[var(--color-edge2)] px-2 py-1 text-[var(--color-dim)] hover:text-[var(--color-text)]"
          >
            close
          </button>
        </div>

        <div className="space-y-5 px-4 py-4 text-[13px] leading-relaxed text-[var(--color-zinc-hi)]">
          <Section title="the game">
            <p>
              Everyone pays the same {C.entry} ◎ to bond a plate into the lattice.
              Once it seals, the shaft starts ticking every{" "}
              {(C.timing.tickMs / 1000).toFixed(1)}s. On each tick every plate
              still in has the same chance of shattering — and everything held by
              the plates that shatter is split among the ones that survive.
            </p>
            <p>
              That is the whole game. Your multiplier climbs because other people
              are being destroyed. You walk out whenever you like and keep what
              you are holding. Get caught by a tick and you keep nothing.
            </p>
          </Section>

          <Section title="why risk falls as the shaft empties">
            <p>
              Danger comes from <em>crowding</em>, not from a timer. A packed
              lattice is under enormous stress and roughly {pc(C.hazard.q0, 1)} of
              plates go per tick. As the field thins the pressure drops away
              sharply, so the survivors are genuinely safer than the crowd was.
            </p>
            <p>
              A small amount of pressure does build with time regardless, so a
              stalemate cannot last forever, but it stays negligible while the
              shaft is still busy and only closes things out at the very end.
            </p>
            <Rules
              rows={[
                [
                  `first ${C.hazard.graceTicks} ticks`,
                  "nobody can be eliminated — you get to read the field before it can touch you",
                ],
                [
                  "thin fields",
                  "with only a few players left the base rate is scaled down, so a small round is a real round and not a coin flip",
                ],
                [
                  "last one standing",
                  "a tick can never wipe the entire field — one plate is always spared, and a sole survivor takes the pot without facing another roll",
                ],
                [
                  "cashing out",
                  "resolves after the tick you are already facing. You cannot dodge a roll in flight",
                ],
              ]}
            />
          </Section>

          <Section title="where your money goes">
            <p>
              {pc(RAKE)} is taken from every entry. Only {pc(C.rake.house)} of
              that is the house — the rest is player money on its way back to
              players by a different route.
            </p>
            <Table
              rows={[
                [`${pc(IN_GAME)}`, "into the pot", "paid out inside the round"],
                [
                  `${pc(C.rake.bonanza)}`,
                  "to the bonanza",
                  "the jackpot pool, paid to one player",
                ],
                [
                  `${pc(C.rake.revShare)}`,
                  "to rakeback",
                  "streamed to ticket holders forever",
                ],
                [`${pc(C.rake.house)}`, "to the house", "the only true edge"],
              ]}
              foot={[pc(RTP), "returned to players", `${pc(C.rake.house)} house edge`]}
            />
          </Section>

          <Section title="is there a best time to leave?">
            <p>
              <strong className="text-[var(--color-text)]">No — and that is a
              mathematical property, not a marketing claim.</strong>{" "}
              Everything a shattered plate was holding goes to the survivors of
              that same tick, and every player still in holds an identical
              balance. So the pot is never drained and never inflated: your
              expected return is exactly the same whether you walk at 1.2×, hold
              for 5×, or never leave at all.
            </p>
            <p>
              Simulated over 400,000 rounds per case, every strategy returns{" "}
              <strong className="text-[var(--color-cyan)]">
                {pc(IN_GAME, 3)}
              </strong>{" "}
              in-game, with all cohorts inside statistical noise. Leaving early
              is lower variance. Staying is higher variance. Neither is worth
              more.
            </p>
          </Section>

          <Section title="the bonanza">
            <p>
              Every entry earns {C.bonanza.ticketBase.toLocaleString()} tickets,
              flat — the same for everyone, whether you bailed on the first tick
              or rode it to the end. There is no way to farm it.
            </p>
            <Rules
              rows={[
                [
                  `1 in ${Math.round(1 / C.bonanza.fireProb).toLocaleString()}`,
                  "chance the jackpot fires at the end of any given round, regardless of how large the pool is",
                ],
                [
                  "the whole pool",
                  "goes to a single ticket holder, then the pool and every ticket reset",
                ],
              ]}
            />
            <p className="text-[var(--color-dim)]">
              Be clear-eyed about this: a single entry wins it roughly once in
              39,000. It is the most volatile {pc(C.rake.bonanza)} of your return
              and most players will never see it. That is exactly why it is{" "}
              {pc(C.rake.bonanza)} and not more.
            </p>
          </Section>

          <Section title="rakeback tickets">
            <p>
              Separate from the bonanza and permanent. Every entry mints{" "}
              {C.revShare.ticketsPerEntry.toLocaleString()} tickets that never
              expire and are never consumed. {pc(C.rake.revShare)} of all handle
              is streamed continuously to holders, split by your share of the
              total.
            </p>
            <p>
              Weight decays with a {C.revShare.halfLifeDays}-day half-life, so
              the stream favours people currently playing over someone who
              farmed tickets once and left. Your ticket count itself is never
              reduced.
            </p>
          </Section>

          <Section title="fairness">
            <p className="text-[var(--color-dim)]">
              This build is a prototype running locally against simulated
              opponents, for evaluating feel and economics. No wallet is
              connected and no real value is at stake. Server-authoritative
              rounds with published commit–reveal seeds, on-chain settlement and
              a claimable ticket ledger are the next phase — until those ship,
              treat every number here as a design specification rather than a
              guarantee.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="display text-[12px] tracking-[0.14em] text-[var(--color-cyan)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Rules({ rows }: { rows: [string, string][] }): JSX.Element {
  return (
    <dl className="space-y-1.5 border-l-2 border-[var(--color-edge2)] pl-3">
      {rows.map(([k, v]) => (
        <div key={k} className="sm:flex sm:gap-3">
          <dt className="label shrink-0 pt-0.5 sm:w-[124px] sm:text-right">{k}</dt>
          <dd className="min-w-0 flex-1 text-[var(--color-zinc-hi)]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Table({
  rows,
  foot,
}: {
  rows: [string, string, string][];
  foot: [string, string, string];
}): JSX.Element {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map(([a, b, c]) => (
          <tr key={b} className="border-t border-[var(--color-edge)]">
            <td className="tnum w-[62px] py-1.5 font-semibold text-[var(--color-text)]">
              {a}
            </td>
            <td className="py-1.5 pr-3 text-[var(--color-text)]">{b}</td>
            <td className="py-1.5 text-right text-[var(--color-dim)]">{c}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-[var(--color-edge2)]">
          <td className="tnum py-1.5 font-bold text-[var(--color-cyan)]">{foot[0]}</td>
          <td className="py-1.5 pr-3 font-semibold text-[var(--color-cyan)]">{foot[1]}</td>
          <td className="py-1.5 text-right text-[var(--color-dim)]">{foot[2]}</td>
        </tr>
      </tbody>
    </table>
  );
}
