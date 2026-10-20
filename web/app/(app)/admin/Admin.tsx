"use client";

import Link from "next/link";
import { useState } from "react";
import ConnectPrompt from "@/components/app/ConnectPrompt";
import Hash from "@/components/app/Hash";
import { sameAddress, useWallet } from "@/lib/wallet";
import {
  ABUSE_REPORTS,
  ADMIN_WALLET,
  AUDIT_LOG,
  type AbuseReport,
  type AuditEntry,
  PROGRAMMES,
  REPORTS,
  balance,
  funded,
  getProgramme,
  paidOut,
} from "@/lib/sample-data";
import { ACCEPTED, OPEN } from "@/lib/status";
import { age, bot, short, TODAY } from "@/lib/format";
import s from "./admin.module.css";

// Figures computed from the rows. Chain figures come from escrow events; report figures from the reports database.
const chain = {
  registered: PROGRAMMES.length,
  fundedNow: PROGRAMMES.filter((p) => balance(p) > 0).length,
  owners: new Set(PROGRAMMES.map((p) => p.owner)).size,
  escrowed: PROGRAMMES.reduce((t, p) => t + funded(p), 0),
  paid: PROGRAMMES.reduce((t, p) => t + paidOut(p), 0),
  payouts: PROGRAMMES.flatMap((p) => p.events).filter((e) => e.kind === "paid").length,
};
const db = {
  reports: REPORTS.length,
  open: REPORTS.filter((r) => OPEN.includes(r.status)).length,
  accepted: REPORTS.filter((r) => ACCEPTED.includes(r.status)).length,
  researchers: new Set(REPORTS.map((r) => r.reporter)).size,
};

const targetLabel = (a: AbuseReport) => (a.targetKind === "programme" ? getProgramme(a.target)?.project ?? a.target : `Report ${a.target}`);

export default function Admin() {
  const w = useWallet();
  const isAdmin = sameAddress(w.address, ADMIN_WALLET);
  const [queue, setQueue] = useState<AbuseReport[]>(ABUSE_REPORTS);
  const [log, setLog] = useState<AuditEntry[]>(AUDIT_LOG);
  const [openId, setOpenId] = useState<string | null>(null);
  const [action, setAction] = useState<"hide" | "dismiss">("dismiss");
  const [reason, setReason] = useState("");

  const open = queue.filter((a) => a.status === "open");
  const hidden = queue.filter((a) => a.status === "hidden");

  const title = (
    <div className="title-row">
      <div>
        <h1>Moderation</h1>
        {isAdmin && (
          <p className="subline">
            <strong>
              {open.length} open abuse {open.length === 1 ? "report" : "reports"}.
            </strong>{" "}
            Admins can hide a programme or reject a submission; they cannot withdraw escrow or redirect a payout.
          </p>
        )}
      </div>
    </div>
  );

  if (!w.address) {
    return (
      <>
        {title}
        <ConnectPrompt sentence="This area is for platform administrators. Connect an admin wallet." preview="Platform admin" />
      </>
    );
  }
  if (!isAdmin) {
    return (
      <>
        {title}
        <p className="empty" style={{ maxWidth: 720 }}>
          This area is for platform administrators. {short(w.address)} is not one, so nothing is shown.
        </p>
      </>
    );
  }

  function decide(a: AbuseReport) {
    const why = reason.trim();
    if (why.length < 10) return;
    const verb = action === "hide" ? (a.targetKind === "programme" ? "Hid programme from directory" : "Rejected report as spam") : `Dismissed abuse report ${a.id}`;
    setQueue(queue.map((x) => (x.id === a.id ? { ...x, status: action === "hide" ? "hidden" : "dismissed" } : x)));
    setLog([{ date: `${TODAY} 10:42`, actor: "Admin · you", action: verb, target: a.target, reason: why }, ...log]);
    setOpenId(null);
    setReason("");
  }

  return (
    <>
      {title}

      <div className={s.lead}>
        <section className={`panel ${s.queuePanel}`} aria-labelledby="queue-h">
          <div className="panel-head">
            <h2 id="queue-h">Abuse reports</h2>
            <span className="panel-meta">Oldest first</span>
          </div>
          {open.length === 0 ? (
            <p className="dash">No open abuse reports.</p>
          ) : (
            <ul className={s.queue}>
              {[...open].sort((x, y) => x.date.localeCompare(y.date)).map((a) => (
                <li key={a.id} className={s.item}>
                  <div className={s.itemHead}>
                    <div>
                      <p className="cell-main">
                        {a.targetKind === "programme" ? (
                          <Link href={`/programs/${a.target}`} className={s.link}>
                            {targetLabel(a)}
                          </Link>
                        ) : (
                          targetLabel(a)
                        )}
                        <span className={s.kind}>{a.targetKind === "programme" ? "Programme" : "Submission"}</span>
                      </p>
                      <p className="cell-sub">
                        <span className="num">{a.id}</span> · reported {age(a.date).toLowerCase()} ago by <Hash value={a.reporter} />
                      </p>
                    </div>
                    {openId !== a.id && (
                      <button className="btn" onClick={() => { setOpenId(a.id); setAction("dismiss"); setReason(""); }}>
                        Review
                      </button>
                    )}
                  </div>
                  <p className={s.reason}>{a.reason}</p>
                  {openId === a.id && (
                    <form className={s.decision} onSubmit={(e) => { e.preventDefault(); decide(a); }}>
                      <div className={s.choices} role="radiogroup" aria-label="Decision">
                        <label data-checked={action === "dismiss" || undefined}>
                          <input type="radio" name={`d-${a.id}`} checked={action === "dismiss"} onChange={() => setAction("dismiss")} /> Dismiss
                        </label>
                        <label data-checked={action === "hide" || undefined}>
                          <input type="radio" name={`d-${a.id}`} checked={action === "hide"} onChange={() => setAction("hide")} />{" "}
                          {a.targetKind === "programme" ? "Hide from directory" : "Reject as spam"}
                        </label>
                      </div>
                      {action === "hide" && a.targetKind === "programme" && (
                        <p className={s.note}>Hiding removes it from discovery only. Its escrow, open reports and payouts are untouched.</p>
                      )}
                      <label htmlFor={`why-${a.id}`} className={s.label}>
                        Reason for the audit log
                      </label>
                      <textarea id={`why-${a.id}`} className="textarea" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                      <div className={s.actions}>
                        <button type="button" className="btn" onClick={() => setOpenId(null)}>
                          Cancel
                        </button>
                        <button className="btn btn-primary" disabled={reason.trim().length < 10}>
                          Record decision
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className={s.foot}>
            Hidden from the directory: {hidden.length ? hidden.map(targetLabel).join(", ") : "none"}. Hidden programmes keep their escrow,
            reports and payouts.
          </p>
        </section>

        <div className="stack">
          <section className="panel" aria-labelledby="chain-h">
            <div className="panel-head">
              <h2 id="chain-h">From the escrow contract</h2>
            </div>
            <dl className={s.metrics}>
              <div>
                <dt>Registered</dt>
                <dd className="num">{chain.registered}</dd>
              </div>
              <div>
                <dt>Funded now</dt>
                <dd className="num">{chain.fundedNow}</dd>
              </div>
              <div>
                <dt>Unique owners</dt>
                <dd className="num">{chain.owners}</dd>
              </div>
              <div>
                <dt>BOT escrowed</dt>
                <dd className="num">{bot(chain.escrowed)}</dd>
              </div>
              <div>
                <dt>BOT paid</dt>
                <dd className="num">{bot(chain.paid)}</dd>
              </div>
              <div>
                <dt>Payouts</dt>
                <dd className="num">{chain.payouts}</dd>
              </div>
            </dl>
          </section>
          <section className="panel" aria-labelledby="db-h">
            <div className="panel-head">
              <h2 id="db-h">From the reports database</h2>
            </div>
            <dl className={`${s.metrics} ${s.metrics2}`}>
              <div>
                <dt>Reports</dt>
                <dd className="num">{db.reports}</dd>
              </div>
              <div>
                <dt>Open</dt>
                <dd className="num">{db.open}</dd>
              </div>
              <div>
                <dt>Accepted</dt>
                <dd className="num">{db.accepted}</dd>
              </div>
              <div>
                <dt>Unique researchers</dt>
                <dd className="num">{db.researchers}</dd>
              </div>
            </dl>
            <p className={s.note}>Report content is not visible here. Admins see counts only.</p>
          </section>
        </div>
      </div>

      <section className="section-gap" aria-labelledby="log-h">
        <div className={s.sectionHead}>
          <h2 id="log-h">Audit log</h2>
          <span className="panel-meta">{log.length} entries · append-only</span>
        </div>
        <table className={`table ${s.log}`}>
          <thead>
            <tr>
              <th className="num">When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e, i) => (
              <tr key={i}>
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  {e.date}
                </td>
                <td>{e.actor}</td>
                <td>
                  <span className="cell-main">{e.action}</span>
                  <div className="cell-sub">
                    {e.target}
                    <span className={s.phoneOnly}>
                      {" "}
                      · {e.actor} · {e.reason}
                    </span>
                  </div>
                </td>
                <td className={s.why}>{e.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
