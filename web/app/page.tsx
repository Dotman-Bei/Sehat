import Link from "next/link";
import h from "./home.module.css";
import Showcase from "@/components/home/Showcase";
import Motion from "@/components/home/Motion";
import {
  EscrowTile,
  FundingEvent,
  PayoutReceipt,
  ScopeList,
  SealedReport,
  TierTable,
  TriageThread,
} from "@/components/home/Fragments";
import { bot, short } from "@/lib/format";
import { PROGRAMMES, balance, getProgramme, getReport, LATEST_BLOCK } from "@/lib/sample-data";
import { ACTIVE_NETWORK, NETWORKS } from "@/lib/config";

const P = (id: string) => getProgramme(id)!;
const R = (id: string) => getReport(id)!;

// ---- stats: platform escrow at the end of each of the last 14 weeks, from the event rows ------
const WEEK_ENDS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 20 - (13 - i) * 7));
  return d.toISOString().slice(0, 10);
});
const escrowAt = (date: string) =>
  PROGRAMMES.flatMap((p) => p.events)
    .filter((e) => e.date <= date)
    .reduce((t, e) => t + (e.kind === "funded" ? e.amount : -e.amount), 0);
const WEEKS = WEEK_ENDS.map((date) => ({ date, value: escrowAt(date) }));
const TOTAL = PROGRAMMES.reduce((t, p) => t + balance(p), 0);
const FUNDED_COUNT = PROGRAMMES.filter((p) => balance(p) > 0).length;
const WEEK_MAX = Math.max(...WEEKS.map((w) => w.value));
const fmtWeek = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const STRIPS = [h.stripAccent, h.stripPaper, h.stripGrey, h.stripLight];

function Frame({
  children,
  label,
  strip = 0,
  className = "",
}: {
  children: React.ReactNode;
  label?: string;
  strip?: number;
  className?: string;
}) {
  return (
    <figure className={`${h.frame} ${className}`}>
      <div className={h.frameBody}>{children}</div>
      {label && <figcaption className={`${h.strip} ${STRIPS[strip % 4]}`}>{label}</figcaption>}
    </figure>
  );
}

function StageCard({ stage }: { stage: 0 | 1 | 2 | 3 }) {
  const r = R("SHT-0163");
  const pill = ["Submitted", "Triage", "Reward agreed", "Paid"][stage];
  return (
    <div className={h.card} data-ui>
      <div className={h.cardHead}>
        <span className="num">{r.id}</span>
        <span className={`${h.cardPill} ${stage === 3 ? h.cardPillPaid : ""}`}>{pill}</span>
      </div>
      <p className={h.cardTitle}>{stage === 0 ? "Sealed until the team opens it" : r.title}</p>
      <dl className={h.cardKv}>
        <dt>Suggested</dt>
        <dd>High</dd>
        <dt>Confirmed</dt>
        <dd>{stage >= 1 ? "High" : "—"}</dd>
        <dt>Triager</dt>
        <dd>{stage >= 1 ? "Tomás Ferreira" : "—"}</dd>
        <dt>Reward</dt>
        <dd className="num">{stage >= 2 ? "9,500 BOT" : "—"}</dd>
        <dt>{stage === 3 ? "Tx" : "Digest"}</dt>
        <dd className="num">{stage === 3 ? "0x51c2…e08a" : short(r.digest)}</dd>
      </dl>
    </div>
  );
}

const FAQ: [string, string][] = [
  [
    "Does Sehat decide whether a report is valid?",
    "No. The programme owner and their triagers review each report and decide. Sehat records the decision and, if a reward is agreed, the contract pays it from escrow.",
  ],
  [
    "Is a reward guaranteed?",
    "No. The contract guarantees the money is in escrow, that a report is never paid twice, and that no payout exceeds the balance. It cannot force an owner to accept a report. Rewards are not guaranteed income.",
  ],
  [
    "What goes on-chain?",
    "The programme reference, funding and payout amounts, wallet addresses, a report digest and the transaction. Report text, reproduction steps and attachments never do.",
  ],
  [
    "Who can read my report?",
    "The programme owner, the triagers they authorise, and platform operators under documented access rules. Reports are stored privately with an access check on every read. They are not end-to-end encrypted.",
  ],
  [
    "What happens when a programme closes?",
    "Open reports keep a payout window. Unused escrow can return to the owner only after the close conditions in the contract are met; until safe closure ships, withdrawal stays disabled.",
  ],
  [
    "Can Sehat staff move escrow?",
    "No. Admins can hide a programme from the directory for abuse. They cannot withdraw escrow or redirect a payout.",
  ],
  [
    "Which network and token?",
    `BOT Chain mainnet (chain ${NETWORKS.mainnet.chainId}) and Bohr testnet (chain ${NETWORKS.testnet.chainId}), paid in native BOT. Sehat has no token of its own.`,
  ],
];

export default function Home() {
  const quayside = P("quayside-bridge");
  const brindle = P("brindle-amm");
  const larkspur = P("larkspur-lending");
  const kestrel = P("kestrel-oracle");

  return (
    <>
      <Motion />

      <header className={h.sitebar} data-sitebar>
        <Link href="/" className={h.sitebarMark}>
          SEHAT
        </Link>
        <nav className={h.sitebarNav} aria-label="Main">
          <Link className="link" href="/programs">
            Programmes
          </Link>
          <Link className="link" href="/researcher">
            Researchers
          </Link>
          <Link className="link" href="/programs/create">
            Owners
          </Link>
        </nav>
        <Link href="/programs" className="button button--small">
          Browse programmes
        </Link>
      </header>

      <main>
        {/* ---- hero: a sheet of the board's own pieces, with one text cell ---- */}
        <section className={h.hero} aria-labelledby="hero-title">
          <div className={h.sheet}>
            <div className={`${h.col} ${h.c1}`} data-drift="0.04">
              <Frame label={`Quayside · ${bot(balance(quayside))} BOT in escrow`} strip={0}>
                <EscrowTile p={quayside} />
              </Frame>
              <Frame label="Bolt work of a vault door" strip={1} className={h.photoTall}>
                <img className="photo" src="/images/vault-workings.jpg" alt="The inside of a bank vault door: bolts, bars and a three-dial time lock" width={1152} height={2048} />
              </Frame>
              <Frame label="Larkspur · in scope" strip={2}>
                <ScopeList p={larkspur} />
              </Frame>
            </div>

            <div className={`${h.col} ${h.c2}`} data-drift="0.1">
              <Frame label="Report SHT-0178 · sealed" strip={3}>
                <SealedReport r={R("SHT-0178")} project="Larkspur" />
              </Frame>
              <Frame label="Brindle · reward tiers" strip={0}>
                <TierTable p={brindle} />
              </Frame>
              <Frame label="Numbered deposit boxes, Zürich" strip={1} className={h.photoSquare}>
                <img className="photo" src="/images/deposit-boxes.jpg" alt="A wall of numbered safe deposit boxes with brass plates" width={1920} height={1952} loading="lazy" />
              </Frame>
            </div>

            <div className={`${h.col} ${h.c34}`}>
              <Frame className={h.photoTop}>
                <div className={`shutter ${h.shutter}`}>
                  <img className="photo" src="/images/time-lock.jpg" alt="Three clock dials of a Yale bank-vault time lock" width={1920} height={1448} fetchPriority="high" />
                </div>
              </Frame>

              <div className={h.panel}>
                <p className={h.wordmark} aria-hidden>
                  SEHAT
                </p>
                <h1 id="hero-title" className={h.title}>
                  Bug bounties held in&nbsp;escrow
                </h1>
                <p className={h.lede}>
                  Teams lock rewards in native BOT before research starts. Researchers report privately and are paid
                  on-chain when a finding is accepted.
                </p>
                <Link href="/programs" className={`button ${h.panelButton}`}>
                  Browse programmes
                </Link>
                <nav className={h.panelLinks} aria-label="Start here">
                  <Link className="link" href="/programs/create">
                    Start a programme
                  </Link>
                  <a className="link" href="#how">
                    How payouts work
                  </a>
                  <a className="link" href="#trust">
                    Trust model
                  </a>
                </nav>
              </div>

              <div className={h.pair}>
                <Frame>
                  <PayoutReceipt r={R("SHT-0142")} project="Brindle" />
                </Frame>
                <Frame>
                  <FundingEvent p={kestrel} />
                </Frame>
              </div>
            </div>

            <div className={`${h.col} ${h.c5}`} data-drift="0.07">
              <Frame label="Triage · needs information" strip={1}>
                <TriageThread r={R("SHT-0170")} project="Fennel" />
              </Frame>
              <Frame label={`Brindle · ${bot(balance(brindle))} BOT in escrow`} strip={2}>
                <EscrowTile p={brindle} />
              </Frame>
              <Frame label="Report SHT-0163 · sealed" strip={3}>
                <SealedReport r={R("SHT-0163")} project="Larkspur" />
              </Frame>
            </div>

            <div className={`${h.col} ${h.c6}`} data-drift="0.12">
              <Frame label="Quayside · reward tiers" strip={0}>
                <TierTable p={quayside} />
              </Frame>
              <Frame label={`Larkspur · ${bot(balance(larkspur))} BOT in escrow`} strip={1}>
                <EscrowTile p={larkspur} />
              </Frame>
              <Frame label="Quayside · in scope" strip={2}>
                <ScopeList p={quayside} />
              </Frame>
            </div>
          </div>
        </section>

        {/* ---- the live thing ---- */}
        <section className={h.showcase} aria-labelledby="chain-title">
          <div className={h.showcaseHead}>
            <h2 id="chain-title" className={h.h2} data-reveal>
              What the chain sees
            </h2>
            <p className={h.text} data-reveal style={{ ["--i" as string]: 1 }}>
              Switch viewers on a real report. The public ledger gets a digest, an address and an amount, and nothing
              else.
            </p>
          </div>
          <div data-reveal style={{ ["--i" as string]: 2 }}>
            <Showcase />
          </div>
          <div className={h.showcaseFoot}>
            <p>Pick a viewer to start, then release the reward twice.</p>
            <a className="link" href="#trust">
              Read the trust model
            </a>
          </div>
        </section>

        {/* ---- one report, four fields ---- */}
        <section id="how" className={h.how} aria-labelledby="how-title">
          {[
            ["First it lands, sealed.", "Only the team can open it. The chain has nothing."],
            ["Then the team triages it.", "They confirm a severity and ask what they need."],
            ["Then both agree the reward.", "The researcher sees the amount before it is paid."],
            ["Then the contract pays it.", "From escrow, once, with a link anyone can check."],
          ].map(([clause, line], i) => (
            <div key={clause} className={`${h.field} ${h[`field${i}`]}`}>
              {i === 0 && (
                <h2 id="how-title" className={h.howTitle} data-reveal>
                  From report to payout
                </h2>
              )}
              <div className={h.fieldCard} data-reveal style={{ ["--i" as string]: i }}>
                <StageCard stage={i as 0 | 1 | 2 | 3} />
              </div>
              <div className={h.fieldWords} data-reveal style={{ ["--i" as string]: i + 1 }}>
                <p className={h.clause}>{clause}</p>
                <p className={h.fieldLine}>{line}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ---- escrow, week by week ---- */}
        <section className={h.stats} aria-labelledby="stats-title">
          <div className={h.statsHead}>
            <p className={`${h.figure} num`} data-reveal>
              {bot(TOTAL)}
              <span className={h.figureUnit}> BOT</span>
            </p>
            <h2 id="stats-title" className={h.statsClaim} data-reveal style={{ ["--i" as string]: 1 }}>
              In escrow across {FUNDED_COUNT} programmes
            </h2>
            <p className={h.statsNote} data-reveal style={{ ["--i" as string]: 2 }}>
              Platform escrow at the end of each week since {fmtWeek(WEEKS[0].date)}. Preview figures from sample
              programmes; live figures are read from the escrow contract at block {bot(LATEST_BLOCK)}.
            </p>
          </div>
          <ol className={h.bars} data-ui aria-label="Escrow at the end of each week, in BOT">
            {WEEKS.map((w, i) => {
              const last = i === WEEKS.length - 1;
              const printed = i === 0 || last || w.value === WEEK_MAX;
              return (
                <li
                  key={w.date}
                  className={`${h.bar} ${last ? h.barNow : ""} ${i < WEEKS.length - 8 ? h.barOld : ""}`}
                  style={{ ["--v" as string]: w.value / WEEK_MAX }}
                  tabIndex={0}
                >
                  <svg className={h.barSvg} viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden>
                    <rect width="10" height="10" />
                  </svg>
                  <span className={`${h.barValue} ${printed ? h.barPrinted : ""} num`}>{bot(w.value)}</span>
                  <span className={h.barWeek}>{last ? "This week" : `Week to ${fmtWeek(w.date)}`}</span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ---- close-ups on a board ---- */}
        <section className={h.features} aria-labelledby="rules-title">
          <div className={`${h.tile} ${h.tH}`}>
            <h2 id="rules-title" className={h.h2} data-reveal>
              Rules you can check
            </h2>
          </div>

          <div className={`${h.tile} ${h.tB}`} data-reveal>
            <div className={h.macro} data-ui style={{ ["--x" as string]: "46%", ["--y" as string]: "8%", fontSize: "30px" }}>
              <p className={h.mLabel}>In escrow · read from contract</p>
              <p className={`${h.mFigure} num`}>{bot(balance(quayside))} BOT</p>
            </div>
            <Caption name="Balance from contract state" line="The figure is read from the escrow contract, not typed in." />
          </div>

          <div className={`${h.tile} ${h.tC} ${h.onAccent}`} data-reveal>
            <div className={h.macro} data-ui style={{ ["--x" as string]: "10%", ["--y" as string]: "12%", fontSize: "34px" }}>
              <p className={h.mRelease}>Release again</p>
              <p className={h.mRefused}>Refused: report reference already paid</p>
            </div>
            <Caption name="One payout per report" line="A paid report reference is refused a second time." />
          </div>

          <div className={`${h.tile} ${h.tD}`} data-reveal style={{ ["--i" as string]: 1 }}>
            <div className={h.macro} data-ui style={{ ["--x" as string]: "10%", ["--y" as string]: "18%", fontSize: "34px" }}>
              <div className={h.mTrack}>
                <span className={h.mFill} />
                <span className={h.mThumb} />
              </div>
              <p className={`${h.mLabel} num`}>32,500 BOT left</p>
            </div>
            <Caption name="Never more than escrow" line="A release above the balance fails in the contract." />
          </div>

          <div className={`${h.tile} ${h.tE} ${h.onPaper}`} data-reveal style={{ ["--i" as string]: 2 }}>
            <div className={h.macro} data-ui style={{ ["--x" as string]: "8%", ["--y" as string]: "8%", fontSize: "30px" }}>
              <p className={h.mWordDim}>High</p>
              <p className={h.mSmall}>suggested</p>
              <p className={h.mWord}>Medium</p>
              <p className={h.mSmall}>confirmed</p>
            </div>
            <Caption name="Severity you confirm" line="The researcher suggests; the owner confirms. Both show." />
          </div>

          <div className={`${h.tile} ${h.tF}`} data-reveal>
            <div className={h.macro} data-ui style={{ ["--x" as string]: "34%", ["--y" as string]: "16%", fontSize: "28px" }}>
              <p className={h.mChip}>Not on-chain</p>
            </div>
            <Caption name="Reports stay off-chain" line="Only a digest, an address and an amount go public." />
          </div>

          <div className={`${h.tile} ${h.tG} ${h.onGrey}`} data-reveal style={{ ["--i" as string]: 1 }}>
            <div className={h.macro} data-ui style={{ ["--x" as string]: "52%", ["--y" as string]: "12%", fontSize: "32px" }}>
              <span className={h.mToggle} aria-hidden>
                <span />
              </span>
              <p className={h.mSmall}>Accepting reports</p>
            </div>
            <Caption name="Pause without losing reports" line="Pausing stops new reports. Nothing is erased." />
          </div>

          <div className={`${h.tile} ${h.tI} ${h.onPaper}`} data-reveal style={{ ["--i" as string]: 2 }}>
            <div className={h.macro} data-ui style={{ ["--x" as string]: "24%", ["--y" as string]: "14%", fontSize: "28px" }}>
              <p className={`${h.mHash} num`}>0x51c2…e08a ↗</p>
            </div>
            <Caption name="Every payout on the explorer" line={`Each paid report links to ${ACTIVE_NETWORK.explorer.replace("https://", "")}.`} />
          </div>

          <div className={`${h.tile} ${h.tJ}`} data-reveal style={{ ["--i" as string]: 3 }}>
            <div className={h.macro} data-ui style={{ ["--x" as string]: "46%", ["--y" as string]: "10%", fontSize: "28px" }}>
              <span className={h.mDiscs}>
                <span>KO</span>
                <span>AL</span>
                <span>+</span>
              </span>
            </div>
            <Caption name="Triagers you authorise" line="Teammates triage; only the owner releases funds." />
          </div>
        </section>

        {/* ---- the trust model, one band per question ---- */}
        <section id="trust" className={h.faq} aria-labelledby="trust-title">
          <div className={h.faqHead}>
            <h2 id="trust-title" className={h.faqTitle} data-reveal>
              The trust model
            </h2>
          </div>
          {FAQ.map(([q, a]) => (
            <div key={q} className={h.band}>
              <h3 className={h.q} data-reveal>
                {q}
              </h3>
              <p className={h.a} data-reveal style={{ ["--i" as string]: 1 }}>
                {a}
              </p>
            </div>
          ))}
        </section>

        {/* ---- the action tile ---- */}
        <section className={h.cta} aria-labelledby="cta-title">
          <div className={`${h.ctaFlank} ${h.ctaLeft}`}>
            <img className="photo" src="/images/vault-workings.jpg" alt="" width={1152} height={2048} loading="lazy" />
          </div>
          <div className={h.ctaMain}>
            <h2 id="cta-title" className={h.ctaTitle} data-reveal>
              Put your bounty in escrow
            </h2>
            <p className={h.ctaText} data-reveal style={{ ["--i" as string]: 1 }}>
              Draft the scope and reward tiers, fund them in native BOT, and publish when the receipt confirms.
              Researchers see the balance the moment it lands.
            </p>
            <div data-reveal style={{ ["--i" as string]: 2 }}>
              <Link href="/programs/create" className="button button--ink">
                Start a programme
              </Link>
            </div>
          </div>
          <div className={`${h.ctaFlank} ${h.ctaRight}`} />
        </section>
      </main>

      <footer className={h.footer}>
        <div className={h.blocks}>
          {["S", "E", "H", "A", "T"].map((l, i) => (
            <span key={i} className={h.block} style={{ ["--h" as string]: ["100%", "74%", "90%", "66%", "96%"][i] }}>
              <svg className={h.blockSvg} viewBox="0 0 100 100" preserveAspectRatio="xMinYMax meet" aria-hidden>
                <text x="4" y="96" className={h.blockLetter}>
                  {l}
                </text>
              </svg>
            </span>
          ))}
          <span className="visually-hidden">Sehat</span>
        </div>
        <div className={h.footGrid}>
          <FootCol title="Programmes" links={[["Browse programmes", "/programs"], ["Start a programme", "/programs/create"], ["Researcher dashboard", "/researcher"]]} />
          <FootCol title="Rules" links={[["Trust model", "#trust"], ["Disclosure rules", "/programs/quayside-bridge#rules"], ["Severity guide", "/programs/quayside-bridge#tiers"]]} />
          <FootCol
            title="Network"
            links={[
              [`BOT Chain mainnet · ${NETWORKS.mainnet.chainId}`, NETWORKS.mainnet.explorer],
              [`Bohr testnet · ${NETWORKS.testnet.chainId}`, NETWORKS.testnet.explorer],
              ["BOT Chain developer docs", "https://dev-docs.botchain.ai/docs/Developers/quick-guide/"],
            ]}
          />
          <FootCol title="Project" links={[["BOT Labs incubation", "https://www.botchain.ai/en/project-party/"], ["Report abuse", "/admin"], ["Platform admin", "/admin"]]} />
          <div className={h.footContact}>
            <p>Report a platform problem through Report abuse.</p>
            <p>Never send a vulnerability by email. Submit it to the programme, where only its team can read it.</p>
          </div>
        </div>
        <div className={h.footLast}>
          <p className={h.credits}>
            © 2026 Sehat. Pictures:{" "}
            <a className="link" href="https://wordpress.org/photos/photo/76567f7bf4/">
              “View of the inside of a bank vault door”
            </a>{" "}
            by Topher, <a className="link" href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a>;{" "}
            <a className="link" href="https://commons.wikimedia.org/wiki/File:Z%C3%BCrich_Switzerland-Safe-deposit-boxes-01.jpg">
              “Zürich Switzerland-Safe-deposit-boxes-01”
            </a>{" "}
            by CEphoto, Uwe Aranas, <a className="link" href="https://creativecommons.org/licenses/by-sa/3.0">CC BY-SA 3.0</a>;{" "}
            <a className="link" href="https://commons.wikimedia.org/wiki/File:Time_lock.agr.jpg">
              “Time lock.agr”
            </a>{" "}
            by ArnoldReinhold, <a className="link" href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>; via
            Wikimedia Commons and the WordPress Photo Directory.
          </p>
          <Link href="/programs" className="button button--small">
            Browse programmes
          </Link>
        </div>
      </footer>
    </>
  );
}

function Caption({ name, line }: { name: string; line: string }) {
  return (
    <div className={h.caption}>
      <h3 className={h.capName}>{name}</h3>
      <p className={h.capLine}>{line}</p>
    </div>
  );
}

function FootCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className={h.footCol}>
      <p className={h.footHead}>{title}</p>
      <ul>
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("http") ? (
              <a className="link" href={href}>
                {label}
              </a>
            ) : (
              <Link className="link" href={href}>
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
