import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Hash from "@/components/app/Hash";
import ReportAbuse from "@/components/app/ReportAbuse";
import { ESCROW_CONTRACT, LATEST_BLOCK, acceptsRewards, balance, funded, paidOut, reportsFor, withdrawn } from "@/lib/sample-data";
import { findProgramme } from "@/lib/programmes";
import { CHAIN_LIVE, ESCROW_ADDRESS, REPORTS_LIVE, addressUrl, txUrl } from "@/lib/config";
import { bot, signed } from "@/lib/format";
import { blockedReason, pillClass, programmeName, programmeState } from "@/lib/status";
import s from "./detail.module.css";

type Params = { programId: string };

// Balances and history come from the escrow contract on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await findProgramme((await params).programId);
  return { title: p ? `${programmeName(p)} · Sehat` : "Programme · Sehat" };
}

export default async function ProgrammeDetail({ params }: { params: Promise<Params> }) {
  const p = await findProgramme((await params).programId);
  if (!p) notFound();
  const contract = CHAIN_LIVE ? ESCROW_ADDRESS : ESCROW_CONTRACT;
  const meta = p.onChain?.metadataStatus;

  const total = funded(p);
  const paid = paidOut(p);
  const out = withdrawn(p);
  const left = balance(p);
  const state = programmeState(p);
  const blocked = blockedReason(p);
  const reports = reportsFor(p.id);
  const paidCount = p.events.filter((e) => e.kind === "paid").length;
  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>
            {programmeName(p)}
          </h1>
          <p className="subline">
            <span className={pillClass(state.tone)} style={{ marginRight: 8 }}>
              {state.label}
            </span>
            {p.test && (
              <span className="pill pill-notice" style={{ marginRight: 8 }}>
                Test programme
              </span>
            )}
            Since {p.startDate}
            {p.endDate ? `, ends ${p.endDate}` : ""}. {p.summary}
          </p>
        </div>
        <div className={`title-actions ${blocked ? s.ctaBlocked : s.cta}`}>
          {blocked ? (
            <span className={s.blocked}>
              <button className="btn btn-primary" disabled aria-describedby="blocked-reason">
                Submit a report
              </button>
              <span id="blocked-reason" className={s.blockedText}>
                {blocked}
              </span>
            </span>
          ) : (
            <Link href={`/programs/${p.id}/submit`} className="btn btn-primary">
              Submit a report
            </Link>
          )}
        </div>
      </div>

      <div className="with-rail">
        <div className="stack">
          <section className="panel" aria-labelledby="escrow-h">
            <div className="panel-head">
              <h2 id="escrow-h">Escrow</h2>
              <span className="panel-meta">
                Read from the escrow contract at block {bot(p.onChain?.readAtBlock ?? LATEST_BLOCK)}
              </span>
            </div>
            <p className="answer">
              {bot(left)}
              <span className="unit">BOT available</span>
            </p>
            <p className={s.answerSub}>
              {acceptsRewards(p)
                ? `Critical findings pay up to ${bot(p.tiers[0].max)} BOT. No single payout can exceed the available balance.`
                : blocked}
            </p>
            {total > 0 && (
              <>
                <div className={`track ${s.track}`} role="img" aria-label={`${bot(paid)} paid, ${bot(out)} returned, ${bot(left)} available, of ${bot(total)} funded`}>
                  {paid > 0 && <span className="t-paid" style={{ width: pct(paid) }} />}
                  {out > 0 && <span className="t-out" style={{ width: pct(out) }} />}
                  {left > 0 && <span className="t-left" style={{ width: pct(left) }} />}
                </div>
                <div className={`legend ${s.legend}`}>
                  <span>
                    <i style={{ background: "#5c5c5c" }} />
                    Paid to researchers <span className="num">{bot(paid)}</span>
                  </span>
                  {out > 0 && (
                    <span>
                      <i style={{ background: "#333" }} />
                      Returned to owner <span className="num">{bot(out)}</span>
                    </span>
                  )}
                  <span>
                    <i style={{ background: "var(--accent)" }} />
                    Available <span className="num">{bot(left)}</span>
                  </span>
                  <span className={s.legendEnd}>
                    Funded <span className="num">{bot(total)}</span> BOT
                  </span>
                </div>
              </>
            )}
          </section>

          <section className="panel" id="tiers" aria-labelledby="tiers-h">
            <div className="panel-head">
              <h2 id="tiers-h">Reward tiers</h2>
              <span className="panel-meta">Guidelines. The team confirms the final severity.</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th className="num">Range (BOT)</th>
                  <th className={s.exampleHead}>Example impact</th>
                </tr>
              </thead>
              <tbody>
                {p.tiers.map((t) => (
                  <tr key={t.severity}>
                    <td className="cell-main">{t.severity}</td>
                    <td className="num">
                      {bot(t.min)}–{bot(t.max)}
                    </td>
                    <td className={s.example}>{t.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel" aria-labelledby="scope-h">
            <div className="panel-head">
              <h2 id="scope-h">Scope</h2>
              <span className="panel-meta">
                {p.scope.length} in scope · {p.outOfScope.length} out of scope
              </span>
            </div>
            <div className={s.scopeGrid}>
              <div>
                <h3 className={s.h3}>In scope</h3>
                <ul className={s.scopeList}>
                  {p.scope.map((t) => (
                    <li key={t.target}>
                      <span className="cell-main">{t.target}</span>
                      <span className="cell-sub">
                        {t.kind} · {t.note}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={s.h3}>Out of scope</h3>
                {p.outOfScope.length ? (
                  <ul className={s.scopeList}>
                    {p.outOfScope.map((t) => (
                      <li key={t.target}>
                        <span className="cell-main">{t.target}</span>
                        <span className="cell-sub">{t.note}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dash">Nothing listed.</p>
                )}
              </div>
            </div>
          </section>

          <section className="panel" id="rules" aria-labelledby="rules-h">
            <div className="panel-head">
              <h2 id="rules-h">Rules of engagement</h2>
              <span className="panel-meta">Confirmed by every researcher before submitting</span>
            </div>
            <ul className="prose">
              {p.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <dl className={s.policy}>
              <dt>Automated scanning</dt>
              <dd>{p.automatedScanning}</dd>
              <dt>Disclosure</dt>
              <dd>{p.disclosure}</dd>
              <dt>Duplicates</dt>
              <dd>{p.duplicates}</dd>
              <dt>Disputes</dt>
              <dd>The team decides validity and reward. Sehat does not adjudicate; the contract enforces only escrow, the balance limit and one payout per report.</dd>
            </dl>
          </section>
        </div>

        <aside className="stack">
          <section className="panel" aria-labelledby="history-h">
            <div className="panel-head">
              <h2 id="history-h">Funding and payouts</h2>
              <span className="panel-meta">
                {p.onChain && !p.onChain.historyComplete ? "History is catching up with the contract" : `${p.events.length} events`}
              </span>
            </div>
            <ol className="events">
              {[...p.events].reverse().map((e) => (
                <li key={e.tx} className="event">
                  <span className="what">
                    {e.kind === "funded" ? "Funded" : e.kind === "paid" ? "Reward paid" : "Unused escrow returned"}
                  </span>
                  <span className="amount">
                    {signed(e.kind === "funded" ? e.amount : -e.amount)} <span className="unit">BOT</span>
                  </span>
                  <span className="meta num">
                    {e.date} · block {bot(e.block)}
                  </span>
                  <span className="meta">
                    <Hash value={e.tx} href={txUrl(e.tx)} />
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel" aria-labelledby="facts-h">
            <div className="panel-head">
              <h2 id="facts-h">Programme</h2>
            </div>
            <dl className="kv">
              <dt>Started</dt>
              <dd>{p.startDate}</dd>
              <dt>Ends</dt>
              <dd>{p.endDate ?? <span className="dash">No end date</span>}</dd>
              <dt>Closing window</dt>
              <dd>{p.closingWindowDays} days</dd>
              <dt>Reports received</dt>
              <dd>{CHAIN_LIVE && !REPORTS_LIVE ? <span className="dash">Reports service not connected</span> : reports.length}</dd>
              <dt>Rewards paid</dt>
              <dd>{paidCount}</dd>
              <dt>Owner</dt>
              <dd>
                <Hash value={p.owner} href={addressUrl(p.owner)} />
              </dd>
              <dt>Escrow contract</dt>
              <dd>
                <Hash value={contract} href={addressUrl(contract)} />
              </dd>
              <dt>Programme ID</dt>
              <dd>{p.onChain ? p.onChain.programmeId : p.id}</dd>
              {p.onChain && (
                <>
                  <dt>Public metadata</dt>
                  <dd>
                    {meta === "verified" ? "Matches on-chain hash" : meta === "mismatch" ? "Does not match on-chain hash" : "Could not be loaded"}
                  </dd>
                  <dt>Metadata hash</dt>
                  <dd>
                    <Hash value={p.onChain.metadataHash} />
                  </dd>
                </>
              )}
            </dl>
            {REPORTS_LIVE && p.onChain && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--rule)", display: "grid" }}>
                <ReportAbuse programmeId={String(p.onChain.programmeId)} project={p.project} />
              </div>
            )}
          </section>
        </aside>
      </div>

      {!blocked && (
        <div className={s.sticky}>
          <Link href={`/programs/${p.id}/submit`} className="btn btn-primary">
            Submit a report
          </Link>
        </div>
      )}
    </>
  );
}
