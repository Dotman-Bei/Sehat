"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConnectPrompt from "@/components/app/ConnectPrompt";
import Hash from "@/components/app/Hash";
import { sameAddress, useWallet } from "@/lib/wallet";
import {
  type Programme,
  type ProgrammeStatus,
  type Report,
  agreedUnpaid,
  balance,
  fakeHex,
  funded,
  paidOut,
  reportsFor,
} from "@/lib/sample-data";
import { CHAIN_LIVE, REPORTS_LIVE, addressUrl, txUrl } from "@/lib/config";
import SignInPanel from "@/components/app/SignIn";
import { type Sender, browserSender, explainError, fundProgramme, setProgrammePaused, startClosing, withdrawUnused } from "@/lib/tx";
import { ago, bot, daysAgo, initials, short } from "@/lib/format";
import { CLOSED_WITHOUT_REWARD, REPORT_STATUS, pillClass, programmeName, programmeState } from "@/lib/status";
import s from "./manage.module.css";

const TABS = [
  { id: "new", label: "Needs triage", test: (r: Report) => r.status === "submitted" },
  { id: "progress", label: "In progress", test: (r: Report) => r.status === "triage" || r.status === "needs_information" },
  { id: "agreed", label: "Reward agreed", test: (r: Report) => r.status === "reward_agreed" || r.status === "accepted" },
  { id: "paid", label: "Paid", test: (r: Report) => r.status === "paid" },
  { id: "closed", label: "Closed", test: (r: Report) => CLOSED_WITHOUT_REWARD.includes(r.status) },
  { id: "all", label: "All", test: () => true },
] as const;
const CAP = 5;
const DISC_TINTS = [
  { bg: "#3a2a2e", fg: "#f0c8cf" },
  { bg: "#23313a", fg: "#c4dceb" },
  { bg: "#2c3524", fg: "#d3e6bf" },
];

type Act = { phase: "idle" | "wallet" | "pending" | "done" | "failed"; hash?: string; error?: string };
const IDLE: Act = { phase: "idle" };

export type LiveQueue = {
  signedIn: boolean;
  reports: Report[];
  keys: Record<string, string>;
  triagers: { wallet: string; name: string }[];
};

export default function Manage({ programme: p, live }: { programme: Programme; live?: LiveQueue }) {
  const w = useWallet();
  const router = useRouter();
  const isOwner = sameAddress(w.address, p.owner);
  const isTriager = (live ? live.triagers : p.triagers).some((t) => sameAddress(t.wallet, w.address));
  const href = (r: Report) => `/reports/${live ? live.keys[r.id] : r.id}`;

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("new");
  const [showAll, setShowAll] = useState(false);
  const [localStatus, setLocalStatus] = useState<ProgrammeStatus>(p.status);
  const status = CHAIN_LIVE ? p.status : localStatus; // live: always the contract's status
  const [pendingStatus, setPendingStatus] = useState<ProgrammeStatus | null>(null);
  const [topUp, setTopUp] = useState("");
  const [fundTx, setFundTx] = useState<Act & { amount?: number }>(IDLE);
  const [statusTx, setStatusTx] = useState<Act>(IDLE);
  const [withdrawTx, setWithdrawTx] = useState<Act>(IDLE);
  const reportsConnected = !CHAIN_LIVE || REPORTS_LIVE;

  /** Live: a real transaction, reported done only after the receipt. Preview: a labelled simulation. */
  async function act(set: (a: Act) => void, run: (s: Sender, onHash: (h: string) => void) => Promise<unknown>, preview: () => void) {
    if (!CHAIN_LIVE) {
      set({ phase: "wallet" });
      setTimeout(() => {
        const hash = fakeHex(`preview-${Date.now()}`);
        set({ phase: "pending", hash });
        setTimeout(() => {
          set({ phase: "done", hash });
          preview();
        }, 1300);
      }, 900);
      return;
    }
    let hash: string | undefined;
    try {
      set({ phase: "wallet" });
      await run(browserSender(w.address!), (h) => {
        hash = h;
        set({ phase: "pending", hash: h });
      });
      set({ phase: "done", hash });
      router.refresh();
    } catch (e) {
      set({ phase: "failed", hash, error: explainError(e) });
    }
  }
  const [triagers, setTriagers] = useState(live ? live.triagers : p.triagers);
  const [newName, setNewName] = useState("");
  const [triagerError, setTriagerError] = useState<string | null>(null);

  async function changeTriagers(add: { wallet: string; name: string } | null, remove: string | null) {
    setTriagerError(null);
    if (!live) {
      if (add) setTriagers([...triagers, add]);
      if (remove) setTriagers(triagers.filter((x) => x.wallet !== remove));
      return;
    }
    try {
      const res = await fetch(`/api/programmes/${p.onChain?.programmeId}/triagers${remove ? `?wallet=${remove}` : ""}`, {
        method: remove ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: add ? JSON.stringify(add) : undefined,
      });
      const data = (await res.json()) as { triagers?: { wallet: string; name: string }[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update triagers.");
      setTriagers(data.triagers ?? []);
    } catch (e) {
      setTriagerError((e as Error).message);
    }
  }
  const [newTriager, setNewTriager] = useState("");

  const reports = live ? live.reports : reportsFor(p.id);
  const added = !CHAIN_LIVE && fundTx.phase === "done" ? fundTx.amount ?? 0 : 0;
  const total = funded(p) + added;
  const paid = paidOut(p);
  const left = balance(p) + added;
  const agreed = live ? reports.filter((r) => r.status === "reward_agreed").reduce((t, r) => t + (r.reward ?? 0), 0) : agreedUnpaid(p);
  const free = left - agreed;
  const waiting = reports.filter((r) => r.status === "submitted").sort((a, b) => a.submitted.localeCompare(b.submitted));
  const awaitingRelease = reports.filter((r) => r.status === "reward_agreed");
  const open = reports.filter((r) => !["paid", ...CLOSED_WITHOUT_REWARD].includes(r.status));

  const title = (
    <div className="title-row">
      <div>
        <h1>
          {programmeName(p)}
        </h1>
        {(isOwner || isTriager) && (
          <p className="subline">
            {waiting.length > 0 ? (
              <strong>
                {waiting.length} {waiting.length === 1 ? "report waits" : "reports wait"} for triage; the oldest arrived {ago(waiting[0].submitted)}.
              </strong>
            ) : (
              "Nothing waits for triage."
            )}{" "}
            {agreed > 0 && (
              <span className="num">
                {bot(agreed)} BOT agreed, {bot(free)} BOT left after it is paid.
              </span>
            )}
          </p>
        )}
      </div>
      <div className="title-actions">
        <Link href={`/programs/${p.id}`} className="btn">
          Public page
        </Link>
      </div>
    </div>
  );

  if (!w.address) {
    return (
      <>
        {title}
        <ConnectPrompt sentence={`Connect the ${p.project} owner wallet or a triager wallet to manage this programme.`} preview={CHAIN_LIVE ? undefined : "Quayside owner"} />
      </>
    );
  }
  if (!isOwner && !isTriager) {
    return (
      <>
        {title}
        <p className="empty" style={{ maxWidth: 720 }}>
          {short(w.address)} is not the owner or a triager of {p.project}. Reports and controls stay hidden.{" "}
          <Link href={`/programs/${p.id}`} style={{ textDecoration: "underline" }}>
            See its public page
          </Link>
          .
        </p>
      </>
    );
  }

  const shownAll = reports.filter(TABS.find((t) => t.id === tab)!.test).sort((a, b) => a.submitted.localeCompare(b.submitted));
  const shown = showAll ? shownAll : shownAll.slice(0, CAP);
  const pct = (n: number) => `${(n / total) * 100}%`;
  const topUpN = Number(topUp.replace(/[,\s]/g, ""));
  const state = programmeState({ ...p, status });

  const id = p.onChain?.programmeId ?? 0;
  const closesAt = p.onChain?.closesAt ?? null;
  // Judged by the time of the block the page was read at, as the contract does, not the browser clock.
  const windowOver = closesAt !== null && (p.onChain?.readAtTime ?? 0) >= closesAt;
  const eligible = CHAIN_LIVE && status === "closing" && windowOver ? left : 0;

  function addFunds() {
    const amount = topUpN;
    const amountText = topUp.replace(/[,\s]/g, "");
    act(
      (a) => setFundTx({ ...a, amount }),
      (sender, onHash) => fundProgramme(sender, id, amountText, onHash),
      () => {},
    ).then(() => setTopUp(""));
  }

  function changeStatus(next: ProgrammeStatus) {
    setPendingStatus(null);
    act(
      setStatusTx,
      (sender, onHash) => (next === "closing" ? startClosing(sender, id, onHash) : setProgrammePaused(sender, id, next === "paused", onHash)),
      () => setLocalStatus(next),
    );
  }

  function withdraw() {
    act(setWithdrawTx, (sender, onHash) => withdrawUnused(sender, id, p.owner as `0x${string}`, onHash), () => {});
  }

  return (
    <>
      {title}

      <div className={s.lead}>
        <section className="panel" aria-labelledby="escrow-h">
          <div className="panel-head">
            <h2 id="escrow-h">Escrow</h2>
            <span className={pillClass(state.tone)}>{state.label}</span>
          </div>
          <p className="answer">
            {bot(left)}
            <span className="unit">BOT in escrow</span>
          </p>
          <p className={s.sub}>
            {bot(free)} BOT is uncommitted after the agreed reward.
          </p>
          <div className={`track ${s.track}`} role="img" aria-label={`${bot(paid)} paid, ${bot(agreed)} agreed, ${bot(free)} uncommitted, of ${bot(total)} funded`}>
            {paid > 0 && <span className="t-paid" style={{ width: pct(paid) }} />}
            {agreed > 0 && <span className={s.hatch} style={{ width: pct(agreed) }} />}
            {free > 0 && <span className="t-left" style={{ width: pct(free) }} />}
          </div>
          <table className={`table ${s.legendTable}`}>
            <tbody>
              <tr>
                <td>
                  <i className={s.swPaid} />
                  Paid to researchers
                </td>
                <td className="num">{bot(paid)}</td>
              </tr>
              <tr>
                <td>
                  <i className={s.swAgreed} />
                  Agreed, not yet released
                </td>
                <td className="num">{bot(agreed)}</td>
              </tr>
              <tr>
                <td>
                  <i className={s.swFree} />
                  Uncommitted
                </td>
                <td className="num">{bot(free)}</td>
              </tr>
              <tr>
                <td>Largest Critical payout</td>
                <td className="num">{bot(p.tiers[0].max)}</td>
              </tr>
              <tr>
                <td className="cell-main">Funded in total</td>
                <td className="num cell-main">{bot(total)}</td>
              </tr>
            </tbody>
          </table>
          {isOwner && (status === "closing" || status === "closed") ? (
            <p className={s.sub}>{status === "closed" ? "This programme is closed." : "Closing: funding has stopped, payouts continue."}</p>
          ) : isOwner ? (
            <div className={s.topUp}>
              {fundTx.phase === "wallet" || fundTx.phase === "pending" ? (
                <TxLine a={fundTx} />
              ) : (
                <>
                  <label htmlFor="topup" className="visually-hidden">
                    Amount to add in BOT
                  </label>
                  <input id="topup" className="input num" inputMode="decimal" placeholder="Amount in BOT" value={topUp} onChange={(e) => setTopUp(e.target.value)} />
                  <button className="btn" disabled={!(topUpN > 0)} onClick={addFunds}>
                    Add funds
                  </button>
                </>
              )}
              {fundTx.phase === "done" && fundTx.hash && (
                <p className={s.txLine}>
                  <span className="pill pill-positive">Funded</span> +{bot(fundTx.amount ?? 0)} BOT · <Hash value={fundTx.hash} href={txUrl(fundTx.hash)} />
                </p>
              )}
              {fundTx.phase === "failed" && <p className={s.err}>{fundTx.error}</p>}
              {!CHAIN_LIVE && fundTx.phase !== "idle" && <p className={s.preview}>Preview build: no transaction is sent.</p>}
            </div>
          ) : (
            <p className={s.sub}>Only the owner wallet can add funds or release rewards.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="release-h">
          <div className="panel-head">
            <h2 id="release-h">Awaiting release</h2>
            <span className="panel-meta">{awaitingRelease.length}</span>
          </div>
          {!reportsConnected ? (
            <p className="dash">Rewards are released from an agreed report. That needs the reports service, which is not connected yet.</p>
          ) : awaitingRelease.length === 0 ? (
            <p className="dash">No agreed rewards are waiting.</p>
          ) : (
            <ul className={s.releaseList}>
              {awaitingRelease.map((r) => (
                <li key={r.id}>
                  <div>
                    <p className="cell-main">{r.title}</p>
                    <p className="cell-sub">
                      <span className="num">{r.id}</span> · {r.confirmed} confirmed · agreed {r.updated}
                    </p>
                  </div>
                  <div className={s.releaseRight}>
                    <p className="num cell-main">
                      {bot(r.reward ?? 0)} <span className="unit">BOT</span>
                    </p>
                    <Link href={href(r)} className="btn btn-primary">
                      Review and release
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={s.recent}>
            <h3 className={s.h3}>
              Recent escrow events
              {p.onChain && !p.onChain.historyComplete && " · catching up with the contract; balances above are current"}
            </h3>
            <ol className="events">
              {p.events.length === 0 && <li className="dash">No escrow events yet.</li>}
              {[...p.events].reverse().slice(0, 3).map((e) => (
                <li key={e.tx} className="event">
                  <span className="what">
                    {e.kind === "funded" ? "Funded" : e.kind === "paid" ? `Paid ${e.reportRef?.startsWith("0x") ? short(e.reportRef) : (e.reportRef ?? "")}` : "Returned"}
                  </span>
                  <span className="amount">
                    {e.kind === "funded" ? "+" : "−"}
                    {bot(e.amount)} <span className="unit">BOT</span>
                  </span>
                  <span className="meta num">{e.date}</span>
                  <span className="meta">
                    <Hash value={e.tx} href={txUrl(e.tx)} />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      <section className="section-gap" aria-labelledby="queue-h">
        <div className={s.sectionHead}>
          <h2 id="queue-h">Reports</h2>
          <span className="panel-meta">
            {reports.length} received · {open.length} open
          </span>
        </div>
        {!reportsConnected ? (
          <p className="empty" style={{ marginTop: 8 }}>
            Reports and triage run through the private reports service, which is not connected to this build yet. The escrow figures and
            controls on this page are live.
          </p>
        ) : live && !live.signedIn ? (
          <div style={{ marginTop: 8 }}>
            <SignInPanel sentence={`Sign in with the ${p.project} owner wallet or a triager wallet to see this programme's reports.`} />
          </div>
        ) : (
        <>
        <div className="tabs" role="tablist" aria-label="Report status">
          {TABS.map((t) => (
            <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setShowAll(false); }}>
              {t.label}
              <span className="count">{reports.filter(t.test).length}</span>
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="empty" style={{ marginTop: 16 }}>No reports in this view.</p>
        ) : (
          <table className={`table ${s.queue}`}>
            <thead>
              <tr>
                <th>Report</th>
                <th>Severity</th>
                <th>Status</th>
                <th className="num">Waiting</th>
                <th className="num">
                  <span className="visually-hidden">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const st = REPORT_STATUS[r.status];
                const days = daysAgo(r.submitted);
                return (
                  <tr key={r.id} className="clickable" onClick={() => router.push(href(r))}>
                    <td className={s.ident}>
                      <span className="cell-main">{r.title}</span>
                      <span className={`${pillClass(st.tone)} ${s.phonePill}`}>{st.label}</span>
                      <div className="cell-sub">
                        <span className="num">{r.id}</span> · {r.target} · <Hash value={r.reporter} />
                        <span className={s.narrow}>
                          {" "}
                          · {r.confirmed ?? r.suggested} {r.confirmed ? "confirmed" : "suggested"}
                          {r.status === "submitted" && ` · waiting ${days} ${days === 1 ? "day" : "days"}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      {r.confirmed ?? r.suggested}
                      <div className="cell-sub">{r.confirmed ? "Confirmed" : "Suggested"}</div>
                    </td>
                    <td>
                      <span className={pillClass(st.tone)}>{st.label}</span>
                    </td>
                    <td className="num">
                      {r.status === "submitted" ? (
                        <>
                          {days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"}`}
                          <div className="cell-sub">since {r.submitted}</div>
                        </>
                      ) : (
                        <>
                          <span className="dash">—</span>
                          <div className="cell-sub">updated {r.updated}</div>
                        </>
                      )}
                    </td>
                    <td className="num">
                      <Link href={href(r)} className="btn" onClick={(e) => e.stopPropagation()}>
                        {r.status === "submitted" ? "Triage" : r.status === "reward_agreed" ? "Release" : "Open"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {shownAll.length > CAP && (
          <button className="btn btn-text" style={{ marginTop: 8 }} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `View all ${shownAll.length}`}
          </button>
        )}
        </>
        )}
      </section>

      <div className={`section-gap ${s.lower}`}>
        <section className="panel" aria-labelledby="status-h">
          <div className="panel-head">
            <h2 id="status-h">Programme status</h2>
            <span className="panel-meta">Closing window {p.closingWindowDays} days</span>
          </div>
          <div className={s.seg} role="radiogroup" aria-label="Programme status">
            {(["active", "paused", "closing"] as ProgrammeStatus[]).map((st) => (
              <button
                key={st}
                role="radio"
                aria-checked={status === st}
                className={s.segBtn}
                disabled={!isOwner || status === "closing" || status === "closed" || statusTx.phase === "wallet" || statusTx.phase === "pending"}
                onClick={() => st !== status && setPendingStatus(st)}
              >
                {st === "active" ? "Active" : st === "paused" ? "Paused" : "Closing"}
              </button>
            ))}
          </div>
          {pendingStatus ? (
            <div className={s.confirmBox}>
              <p>
                {pendingStatus === "paused" && "Pausing stops new reports. Submitted reports, triage and payouts carry on."}
                {pendingStatus === "active" && "Resuming opens the programme to new reports again."}
                {pendingStatus === "closing" &&
                  `Closing stops new reports for good. The ${open.length} open reports keep a ${p.closingWindowDays}-day window to be resolved and paid. This cannot be reversed.`}
              </p>
              <div className={s.confirmActions}>
                <button className="btn" onClick={() => setPendingStatus(null)}>
                  Cancel
                </button>
                <button
                  className={`btn ${pendingStatus === "closing" ? "btn-danger" : "btn-primary"}`}
                  onClick={() => changeStatus(pendingStatus)}
                >
                  {pendingStatus === "paused" ? "Pause programme" : pendingStatus === "active" ? "Resume programme" : `Close ${p.project}`}
                </button>
              </div>
            </div>
          ) : statusTx.phase === "wallet" || statusTx.phase === "pending" ? (
            <TxLine a={statusTx} />
          ) : (
            <p className={s.sub}>
              {statusTx.phase === "failed" && <span className={s.err}>{statusTx.error} </span>}
              {status === "closed" && "Closed. Unused escrow has been withdrawn; the payout history stays on-chain."}
              {status === "active" && "Accepting reports."}
              {status === "paused" && "Paused. No new reports; everything submitted carries on."}
              {status === "closing" &&
                (closesAt
                  ? `Closing. No new reports; rewards can still be paid until ${new Date(closesAt * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC.`
                  : `Closing. No new reports; ${open.length} open reports keep their payout window.`)}
              {!isOwner && " Only the owner wallet can change this."}
            </p>
          )}
          <dl className={`kv ${s.closure}`}>
            <dt>Open reports</dt>
            <dd className="num">{reportsConnected ? open.length : <span className="dash">Not connected</span>}</dd>
            <dt>Closing window</dt>
            <dd className="num">{p.closingWindowDays} days</dd>
            <dt>Eligible to withdraw</dt>
            <dd className="num">{bot(eligible)} BOT</dd>
          </dl>
          {isOwner && eligible > 0 && (
            <div className={s.topUp}>
              {withdrawTx.phase === "wallet" || withdrawTx.phase === "pending" ? (
                <TxLine a={withdrawTx} />
              ) : (
                <button className="btn btn-primary" onClick={withdraw}>
                  Withdraw {bot(eligible)} BOT to the owner wallet
                </button>
              )}
              {withdrawTx.phase === "failed" && <p className={s.err}>{withdrawTx.error}</p>}
            </div>
          )}
          <p className={s.sub}>
            Unused escrow can be withdrawn only after closing, once the {p.closingWindowDays}-day window has ended. The contract cannot see
            reports, so resolve and pay every accepted one before the window ends.
          </p>
        </section>

        <section className="panel" aria-labelledby="triagers-h">
          <div className="panel-head">
            <h2 id="triagers-h">Triagers</h2>
            <span className="panel-meta">Can read reports and decide status · cannot release funds</span>
          </div>
          <ul className={s.people}>
            <li>
              <span className="disc" style={{ background: "#3a3a3a", color: "var(--text)" }}>
                OW
              </span>
              <span>
                <span className="cell-main">Owner</span>
                <span className="cell-sub">
                  <Hash value={p.owner} href={addressUrl(p.owner)} />
                </span>
              </span>
              <span className="dash">Releases funds</span>
            </li>
            {triagers.map((t, i) => (
              <li key={t.wallet}>
                <span className="disc" style={{ background: DISC_TINTS[i % 3].bg, color: DISC_TINTS[i % 3].fg }}>
                  {initials(t.name)}
                </span>
                <span>
                  <span className="cell-main">{t.name}</span>
                  <span className="cell-sub">
                    <Hash value={t.wallet} />
                  </span>
                </span>
                {isOwner && reportsConnected ? (
                  <button className="btn btn-text" onClick={() => changeTriagers(null, t.wallet)}>
                    Remove
                  </button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
          {isOwner && !reportsConnected && (
            <p className={s.sub} style={{ marginTop: 12 }}>
              Triagers get access to reports through the reports service, which is not connected yet.
            </p>
          )}
          {isOwner && reportsConnected && (
            <form
              className={s.addRow}
              onSubmit={(e) => {
                e.preventDefault();
                if (!/^0x[0-9a-fA-F]{40}$/.test(newTriager.trim())) return;
                void changeTriagers({ wallet: newTriager.trim(), name: newName.trim() || `Triager ${short(newTriager.trim())}` }, null).then(() => {
                  setNewTriager("");
                  setNewName("");
                });
              }}
            >
              <label htmlFor="new-triager" className="visually-hidden">
                Triager wallet address
              </label>
              <input id="new-triager" className="input num" placeholder="0x… wallet address" value={newTriager} onChange={(e) => setNewTriager(e.target.value)} />
              <label htmlFor="new-triager-name" className="visually-hidden">
                Triager name
              </label>
              <input id="new-triager-name" className="input" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ maxWidth: 160 }} />
              <button className="btn" disabled={!/^0x[0-9a-fA-F]{40}$/.test(newTriager.trim())}>
                Add triager
              </button>
            </form>
          )}
          {triagerError && <p className={s.err} style={{ marginTop: 8 }}>{triagerError}</p>}
        </section>
      </div>
    </>
  );
}

function TxLine({ a }: { a: Act }) {
  return (
    <p className={s.txLine} aria-live="polite">
      {a.phase === "wallet" ? "Confirm in your wallet…" : <>Waiting for the receipt · {a.hash ? <Hash value={a.hash} href={txUrl(a.hash)} /> : null}</>}
    </p>
  );
}
