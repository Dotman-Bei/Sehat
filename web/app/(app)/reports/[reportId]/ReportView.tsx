"use client";

// In production the report body is fetched from the private reports API, which checks the
// signed-in wallet on every read; nothing here is a substitute for that server-side check.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ConnectPrompt from "@/components/app/ConnectPrompt";
import Hash from "@/components/app/Hash";
import { sameAddress, useWallet } from "@/lib/wallet";
import {
  type Message,
  type ReportStatus,
  type Severity,
  balance,
  fakeHex,
  getProgramme,
  getReport,
} from "@/lib/sample-data";
import { ACTIVE_NETWORK, PREVIEW_DATA, txUrl } from "@/lib/config";
import { bot, short, TODAY } from "@/lib/format";
import { REPORT_STATUS, pillClass } from "@/lib/status";
import s from "./report.module.css";

const PATH: { status: ReportStatus; label: string }[] = [
  { status: "submitted", label: "Submitted" },
  { status: "triage", label: "Triage" },
  { status: "accepted", label: "Accepted" },
  { status: "reward_agreed", label: "Reward agreed" },
  { status: "paid", label: "Paid" },
];
const STEP: Partial<Record<ReportStatus, number>> = { submitted: 0, triage: 1, needs_information: 1, accepted: 2, reward_agreed: 3, paid: 4 };
const DECISIONS: { status: ReportStatus; label: string; needsReason: boolean }[] = [
  { status: "triage", label: "In triage", needsReason: false },
  { status: "needs_information", label: "Needs information", needsReason: true },
  { status: "accepted", label: "Accepted", needsReason: false },
  { status: "duplicate", label: "Duplicate", needsReason: true },
  { status: "out_of_scope", label: "Out of scope", needsReason: true },
  { status: "invalid", label: "Invalid", needsReason: true },
];

type Tx = { phase: "idle" | "confirm" | "wallet" | "pending" | "confirmed" | "failed"; hash?: string; block?: number; error?: string };

export default function ReportView({ reportId }: { reportId: string }) {
  const report = getReport(reportId)!;
  const p = getProgramme(report.programmeId)!;
  const w = useWallet();

  const isResearcher = sameAddress(w.address, report.reporter);
  const isOwner = sameAddress(w.address, p.owner);
  const isTriager = p.triagers.some((t) => sameAddress(t.wallet, w.address));
  const isTeam = isOwner || isTriager;

  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [confirmed, setConfirmed] = useState<Severity | undefined>(report.confirmed);
  const [reward, setReward] = useState<number | undefined>(report.reward);
  const [reason, setReason] = useState(report.reason ?? "");
  const [thread, setThread] = useState<Message[]>(report.thread);
  const [tx, setTx] = useState<Tx>(report.payoutTx ? { phase: "confirmed", hash: report.payoutTx, block: report.payoutBlock } : { phase: "idle" });

  const escrow = balance(p) - (tx.phase === "confirmed" && report.status !== "paid" ? reward ?? 0 : 0);
  const paid = status === "paid";

  const title = (
    <div className="title-row">
      <div>
        <h1>{isResearcher || isTeam ? report.title : report.id}</h1>
        <p className="subline">
          <span className="num">{report.id}</span> · <Link href={`/programs/${p.id}`} className={s.inline}>{p.project}</Link> · submitted {report.submitted}
        </p>
      </div>
      {(isResearcher || isTeam) && (
        <span className={pillClass(REPORT_STATUS[status].tone)} style={{ height: 26, padding: "0 10px", fontSize: 13 }}>
          {REPORT_STATUS[status].label}
        </span>
      )}
    </div>
  );

  if (!w.address) {
    return (
      <>
        {title}
        <ConnectPrompt sentence={`This report is private to its researcher and the ${p.project} team. Connect the wallet that submitted it, or a wallet on the team.`} preview="Researcher" />
      </>
    );
  }
  if (!isResearcher && !isTeam) {
    return (
      <>
        {title}
        <p className="empty" style={{ maxWidth: 720 }}>
          This report is private to its researcher and the {p.project} team. The connected wallet {short(w.address)} is neither, so nothing
          about it is shown.
        </p>
      </>
    );
  }

  const step = STEP[status];
  const offPath = step === undefined || status === "needs_information";
  const tier = confirmed ? p.tiers.find((t) => t.severity === confirmed) : undefined;
  const visible = thread.filter((m) => isTeam || !m.teamOnly);

  return (
    <>
      {title}

      <ol className={s.path} aria-label="Report progress">
        {PATH.map((st, i) => {
          const state = step === undefined ? "future" : i < step ? "done" : i === step ? "current" : "future";
          return (
            <li key={st.status} className={s.step} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className={s.stepLabel}>{st.label}</span>
            </li>
          );
        })}
      </ol>
      {offPath && (
        <p className={s.offPath}>
          <span className={pillClass(REPORT_STATUS[status].tone)}>{REPORT_STATUS[status].label}</span>
          <span>{reason || (status === "needs_information" ? "The team asked a question below." : "")}</span>
        </p>
      )}

      <div className="with-rail" style={{ marginTop: 24 }}>
        <div className="stack">
          <section className="panel" aria-labelledby="body-h">
            <div className="panel-head">
              <h2 id="body-h">Report</h2>
              <span className="panel-meta">Private · never written to the chain</span>
            </div>
            <dl className={s.facts}>
              <dt>Target</dt>
              <dd>{report.target}</dd>
              <dt>Category</dt>
              <dd>{report.category}</dd>
              <dt>Reporter</dt>
              <dd>
                <Hash value={report.reporter} />
              </dd>
            </dl>
            <h3 className={s.h3}>Impact</h3>
            <p className={s.prose}>{report.impact}</p>
            <h3 className={s.h3}>Reproduction steps</h3>
            <ol className={s.steps}>
              {report.steps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <h3 className={s.h3}>Attachments</h3>
            {report.attachments.length ? (
              <ul className={s.files}>
                {report.attachments.map((a) => (
                  <li key={a.name}>
                    <span>{a.name}</span>
                    <span className="dash num">{a.size}</span>
                    <button className="btn btn-text" disabled={PREVIEW_DATA} title={PREVIEW_DATA ? "Preview build: no files are stored" : undefined}>
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dash">No attachments.</p>
            )}
          </section>

          <Thread
            visible={visible}
            isTeam={isTeam}
            project={p.project}
            onSend={(m) => setThread((t) => [...t, m])}
            teamName={isOwner ? `${p.project} owner` : p.triagers.find((t) => sameAddress(t.wallet, w.address))?.name ?? "Team"}
          />
        </div>

        <aside className="stack">
          <section className="panel" aria-labelledby="sev-h">
            <div className="panel-head">
              <h2 id="sev-h">Severity</h2>
            </div>
            <dl className="kv">
              <dt>Suggested by researcher</dt>
              <dd>{report.suggested}</dd>
              <dt>Confirmed by team</dt>
              <dd>{confirmed ?? <span className="dash">Not yet</span>}</dd>
              {tier && (
                <>
                  <dt>{confirmed} range</dt>
                  <dd>
                    {bot(tier.min)}–{bot(tier.max)} BOT
                  </dd>
                </>
              )}
            </dl>
          </section>

          {isTeam && !paid && status !== "reward_agreed" && (
            <Triage
              key={status}
              status={status}
              confirmed={confirmed}
              tiers={p.tiers}
              escrow={escrow}
              onDecide={(st, why, sev, amount) => {
                setStatus(st);
                setReason(why);
                if (sev) setConfirmed(sev);
                if (amount) setReward(amount);
              }}
            />
          )}

          <section className="panel" aria-labelledby="reward-h">
            <div className="panel-head">
              <h2 id="reward-h">Reward</h2>
              <span className="panel-meta">From {p.project} escrow</span>
            </div>
            {reward ? (
              <>
                <p className="answer">
                  {bot(reward)}
                  <span className="unit">BOT {paid ? "paid" : "agreed"}</span>
                </p>
                <dl className="kv" style={{ marginTop: 12 }}>
                  <dt>Recipient</dt>
                  <dd>
                    <Hash value={report.reporter} />
                  </dd>
                  <dt>Escrow available</dt>
                  <dd className="num">{bot(escrow)} BOT</dd>
                </dl>
                <Release
                  canRelease={isOwner}
                  isResearcher={isResearcher}
                  project={p.project}
                  reportId={report.id}
                  recipient={report.reporter}
                  amount={reward}
                  escrow={balance(p)}
                  tx={tx}
                  setTx={setTx}
                  onPaid={() => setStatus("paid")}
                  wrongChain={w.wrongChain}
                />
              </>
            ) : (
              <p className="dash">
                {status === "duplicate" || status === "out_of_scope" || status === "invalid"
                  ? "Closed without reward."
                  : "No reward agreed yet. The team proposes one after confirming severity."}
              </p>
            )}
          </section>

          <section className="panel" aria-labelledby="chain-h">
            <div className="panel-head">
              <h2 id="chain-h">On-chain record</h2>
            </div>
            <dl className="kv">
              <dt>Report digest</dt>
              <dd>
                <Hash value={report.digest} />
              </dd>
              <dt>Payout</dt>
              <dd>{tx.phase === "confirmed" && tx.hash ? <Hash value={tx.hash} href={txUrl(tx.hash)} /> : <span className="dash">None</span>}</dd>
            </dl>
            <p className={s.note}>Only the digest, recipient and amount appear in the payout event. The title, steps and thread stay private.</p>
          </section>
        </aside>
      </div>
    </>
  );
}

function Thread({ visible, isTeam, project, onSend, teamName }: { visible: Message[]; isTeam: boolean; project: string; onSend: (m: Message) => void; teamName: string }) {
  const [text, setText] = useState("");
  const [teamOnly, setTeamOnly] = useState(false);
  return (
    <section className="panel" aria-labelledby="thread-h">
      <div className="panel-head">
        <h2 id="thread-h">Conversation</h2>
        <span className="panel-meta">{isTeam ? "Notes marked team only are hidden from the researcher" : `Between you and the ${project} team`}</span>
      </div>
      {visible.length === 0 ? (
        <p className="dash">No messages yet. The team usually replies here first.</p>
      ) : (
        <ol className={s.thread}>
          {visible.map((m, i) => (
            <li key={i} className={s.msg} data-team-only={m.teamOnly || undefined}>
              <p className={s.msgHead}>
                <span className="cell-main">{m.from === "researcher" ? (isTeam ? "Researcher" : "You") : m.author}</span>
                {m.teamOnly && <span className={s.teamOnly}>Team only</span>}
                <span className="dash num">{m.date}</span>
              </p>
              <p className={s.prose}>{m.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form
        className={s.composer}
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onSend({ from: isTeam ? "team" : "researcher", author: isTeam ? teamName : "You", date: TODAY, body: text.trim(), teamOnly: isTeam && teamOnly });
          setText("");
        }}
      >
        <label htmlFor="reply" className="visually-hidden">
          Message
        </label>
        <textarea id="reply" className="textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={isTeam ? "Ask the researcher, or leave a team-only note" : `Reply to the ${project} team`} />
        <div className={s.composerRow}>
          {isTeam && (
            <label className={s.check}>
              <input type="checkbox" checked={teamOnly} onChange={(e) => setTeamOnly(e.target.checked)} /> Team only
            </label>
          )}
          <button className="btn btn-primary" disabled={!text.trim()}>
            {isTeam && teamOnly ? "Add note" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Triage({
  status,
  confirmed,
  tiers,
  escrow,
  onDecide,
}: {
  status: ReportStatus;
  confirmed?: Severity;
  tiers: { severity: Severity; min: number; max: number }[];
  escrow: number;
  onDecide: (s: ReportStatus, reason: string, sev?: Severity, amount?: number) => void;
}) {
  const [decision, setDecision] = useState<ReportStatus>(status === "submitted" ? "triage" : status);
  const [why, setWhy] = useState("");
  const [sev, setSev] = useState<Severity | "">(confirmed ?? "");
  const [amount, setAmount] = useState("");
  const d = DECISIONS.find((x) => x.status === decision)!;
  const tier = tiers.find((t) => t.severity === sev);
  const n = Number(amount.replace(/,/g, ""));
  const accepting = decision === "accepted";
  const amountError = accepting && amount
    ? !tier
      ? "Confirm a severity first."
      : n < tier.min || n > tier.max
        ? `${sev} pays ${bot(tier.min)}–${bot(tier.max)} BOT on this programme.`
        : n > escrow
          ? `Escrow holds ${bot(escrow)} BOT; this reward would fail in the contract.`
          : null
    : null;
  const ready = d.needsReason ? why.trim().length >= 10 : accepting ? !!tier && !!amount && !amountError : true;

  return (
    <section className="panel" aria-labelledby="triage-h">
      <div className="panel-head">
        <h2 id="triage-h">Triage</h2>
        <span className="panel-meta">Team only</span>
      </div>
      <form
        className={s.triage}
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          onDecide(accepting ? "reward_agreed" : decision, why.trim(), sev || undefined, accepting ? n : undefined);
        }}
      >
        <label className={s.label} htmlFor="t-decision">
          Decision
        </label>
        <select id="t-decision" className="select" value={decision} onChange={(e) => setDecision(e.target.value as ReportStatus)}>
          {DECISIONS.map((x) => (
            <option key={x.status} value={x.status}>
              {x.label}
            </option>
          ))}
        </select>
        <label className={s.label} htmlFor="t-sev">
          Confirmed severity
        </label>
        <select id="t-sev" className="select" value={sev} onChange={(e) => setSev(e.target.value as Severity)}>
          <option value="">Not confirmed</option>
          {tiers.map((t) => (
            <option key={t.severity}>{t.severity}</option>
          ))}
        </select>
        {accepting && (
          <>
            <label className={s.label} htmlFor="t-amount">
              Proposed reward (BOT)
            </label>
            <input id="t-amount" className="input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={tier ? `${bot(tier.min)}–${bot(tier.max)}` : "Confirm a severity first"} aria-invalid={!!amountError} />
            {amountError && <p className={s.err}>{amountError}</p>}
          </>
        )}
        {d.needsReason && (
          <>
            <label className={s.label} htmlFor="t-why">
              Reason shown to the researcher
            </label>
            <textarea id="t-why" className="textarea" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
          </>
        )}
        <button className="btn btn-primary" disabled={!ready}>
          {accepting ? "Accept and propose reward" : `Mark as ${d.label.toLowerCase()}`}
        </button>
        {accepting && <p className={s.note}>The researcher sees the amount before anything is paid.</p>}
      </form>
    </section>
  );
}

function Release({
  canRelease,
  isResearcher,
  project,
  reportId,
  recipient,
  amount,
  escrow,
  tx,
  setTx,
  onPaid,
  wrongChain,
}: {
  canRelease: boolean;
  isResearcher: boolean;
  project: string;
  reportId: string;
  recipient: string;
  amount: number;
  escrow: number;
  tx: Tx;
  setTx: (t: Tx) => void;
  onPaid: () => void;
  wrongChain: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (tx.phase === "confirm") dialog.current?.showModal();
    else dialog.current?.close();
  }, [tx.phase]);

  function send() {
    setTx({ phase: "wallet" });
    setTimeout(() => {
      const hash = fakeHex(`release-${reportId}-${amount}`);
      setTx({ phase: "pending", hash });
      setTimeout(() => {
        setTx({ phase: "confirmed", hash, block: 1_284_644 });
        onPaid();
      }, 1400);
    }, 900);
  }

  if (tx.phase === "confirmed" && tx.hash) {
    return (
      <div className={s.txDone}>
        <p>
          <span className="pill pill-positive">Paid</span> in block <span className="num">{bot(tx.block ?? 0)}</span>
        </p>
        <Hash value={tx.hash} href={txUrl(tx.hash)} head={6} tail={6} />
        <p className={s.note}>A second release for {reportId} is refused by the contract.</p>
      </div>
    );
  }

  if (!canRelease) {
    return (
      <p className={s.note} style={{ marginTop: 12 }}>
        {isResearcher ? `Waiting for the ${project} owner to release it. The transaction appears here when it confirms.` : "Only the programme owner's wallet can release a reward."}
      </p>
    );
  }

  const over = amount > escrow;
  return (
    <div className={s.release}>
      {tx.phase === "idle" || tx.phase === "confirm" || tx.phase === "failed" ? (
        <>
          <button className="btn btn-primary" disabled={over || wrongChain} onClick={() => setTx({ phase: "confirm" })}>
            Release {bot(amount)} BOT
          </button>
          {over && <p className={s.err}>Escrow holds {bot(escrow)} BOT; add funds before releasing {bot(amount)} BOT.</p>}
          {wrongChain && <p className={s.err}>Switch the wallet to {ACTIVE_NETWORK.name} first.</p>}
          {tx.phase === "failed" && <p className={s.err}>{tx.error}</p>}
        </>
      ) : (
        <ol className={s.txSteps} aria-live="polite">
          <li data-state={tx.phase === "wallet" ? "now" : "done"}>Confirm in your wallet</li>
          <li data-state={tx.phase === "pending" ? "now" : tx.phase === "wallet" ? "next" : "done"}>
            Waiting for the receipt {tx.hash && <span className="num dash">· {short(tx.hash)}</span>}
          </li>
          <li data-state="next">Paid</li>
        </ol>
      )}
      {PREVIEW_DATA && (tx.phase === "wallet" || tx.phase === "pending") && <p className={s.previewNote}>Preview build: no transaction is sent.</p>}

      <dialog ref={dialog} className={s.dialog} onClose={() => tx.phase === "confirm" && setTx({ phase: "idle" })} aria-labelledby="dlg-h">
        <h2 id="dlg-h">Release {bot(amount)} BOT to the researcher?</h2>
        <dl className="kv">
          <dt>Programme</dt>
          <dd>{project}</dd>
          <dt>Report reference</dt>
          <dd className="num">{reportId}</dd>
          <dt>Recipient</dt>
          <dd className="num" style={{ fontSize: 13 }}>{recipient}</dd>
          <dt>Amount</dt>
          <dd className="num">{bot(amount)} BOT</dd>
          <dt>Escrow after</dt>
          <dd className="num">{bot(escrow - amount)} BOT</dd>
        </dl>
        <p className={s.note}>This cannot be undone. The contract pays each report reference once.</p>
        <div className={s.dlgActions}>
          <button className="btn" onClick={() => setTx({ phase: "idle" })}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={send}>
            Release {bot(amount)} BOT
          </button>
        </div>
      </dialog>
    </div>
  );
}
