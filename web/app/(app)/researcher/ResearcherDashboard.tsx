"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ConnectPrompt from "@/components/app/ConnectPrompt";
import Hash from "@/components/app/Hash";
import { useWallet } from "@/lib/wallet";
import { type Report, getProgramme, researcherReports } from "@/lib/sample-data";
import { ACCEPTED, CLOSED_WITHOUT_REWARD, OPEN, REPORT_STATUS, pillClass } from "@/lib/status";
import { age, bot } from "@/lib/format";
import { txUrl } from "@/lib/config";
import s from "./researcher.module.css";

const TABS = [
  { id: "all", label: "All", test: () => true },
  { id: "open", label: "Open", test: (r: Report) => OPEN.includes(r.status) },
  { id: "accepted", label: "Accepted", test: (r: Report) => ACCEPTED.includes(r.status) },
  { id: "closed", label: "Closed without reward", test: (r: Report) => CLOSED_WITHOUT_REWARD.includes(r.status) },
] as const;

export type LiveReports = { reports: Report[]; keys: Record<string, string>; names: Record<string, string> };

export default function ResearcherDashboard({ live }: { live?: LiveReports }) {
  const project = (r: Report) => (live ? live.names[r.programmeId] ?? `Programme ${r.programmeId}` : getProgramme(r.programmeId)?.project ?? r.programmeId);
  const nameOf = (id: string) => (live ? live.names[id] ?? `Programme ${id}` : getProgramme(id)?.project);
  // Live links use the report's private id, never its reference.
  const href = (r: Report) => `/reports/${live ? live.keys[r.id] : r.id}`;
  const { address } = useWallet();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [prog, setProg] = useState("all");
  const [order, setOrder] = useState<"updated" | "submitted">("updated");

  const reports = useMemo(() => (live ? live.reports : address ? researcherReports(address) : []), [address, live]);
  const needInfo = reports.filter((r) => r.status === "needs_information");
  const agreed = reports.filter((r) => r.status === "reward_agreed");
  const paid = reports.filter((r) => r.status === "paid");
  const agreedTotal = agreed.reduce((t, r) => t + (r.reward ?? 0), 0);
  const paidTotal = paid.reduce((t, r) => t + (r.reward ?? 0), 0);
  const programmes = [...new Set(reports.map((r) => r.programmeId))];

  const inProg = reports.filter((r) => prog === "all" || r.programmeId === prog);
  const shown = inProg
    .filter(TABS.find((t) => t.id === tab)!.test)
    .sort((a, b) => (order === "updated" ? b.updated.localeCompare(a.updated) : b.submitted.localeCompare(a.submitted)));

  const title = (
    <div className="title-row">
      <div>
        <h1>Your reports</h1>
        {address && reports.length > 0 && (
          <p className="subline">
            {needInfo.length > 0 ? (
              <>
                <strong>
                  {needInfo.length} {needInfo.length === 1 ? "report needs" : "reports need"} information from you.
                </strong>{" "}
              </>
            ) : (
              "Nothing waits on you. "
            )}
            {agreedTotal > 0 && (
              <>
                <span className="num">{bot(agreedTotal)} BOT</span> agreed and awaiting release by the programme owner.
              </>
            )}
          </p>
        )}
      </div>
      <div className="title-actions">
        <Link href="/programs" className="btn">
          Find a programme
        </Link>
      </div>
    </div>
  );

  if (!live && !address) {
    return (
      <>
        {title}
        <ConnectPrompt sentence="Connect a wallet to see the reports you submitted from it. Reports are private, so nothing shows here without one." preview="Researcher" />
      </>
    );
  }

  if (reports.length === 0) {
    return (
      <>
        {title}
        <p className="empty">
          No reports from this wallet yet. <Link href="/programs" style={{ textDecoration: "underline" }}>Browse programmes</Link> to find one in scope.
        </p>
      </>
    );
  }

  return (
    <>
      {title}

      <div className={s.lead}>
        <section className={`panel ${s.needs}`} aria-labelledby="needs-h">
          <div className="panel-head">
            <h2 id="needs-h">Waiting on your reply</h2>
            <span className="panel-meta">{needInfo.length}</span>
          </div>
          {needInfo.length === 0 ? (
            <p className="dash">No questions from programme teams.</p>
          ) : (
            needInfo.map((r) => {
              const q = [...r.thread].reverse().find((m) => m.from === "team" && !m.teamOnly);
              return (
                <div key={r.id} className={s.question}>
                  <p className={s.qHead}>
                    <span className="num">{r.id}</span> · {project(r)} · asked {age(q?.date ?? r.updated).toLowerCase()} ago
                  </p>
                  <p className="cell-main">{r.title}</p>
                  {q && <blockquote className={s.quote}>{q.body}</blockquote>}
                  <Link href={href(r)} className="btn btn-primary" style={{ justifySelf: "start" }}>
                    Reply to {q?.author ?? "the team"}
                  </Link>
                </div>
              );
            })
          )}
        </section>

        <section className={`panel ${s.money}`} aria-labelledby="money-h">
          <div className="panel-head">
            <h2 id="money-h">Rewards</h2>
            <span className="panel-meta">Paid from programme escrow</span>
          </div>
          <p className="answer">
            {bot(agreedTotal)}
            <span className="unit">BOT awaiting release</span>
          </p>
          <ul className={s.rewardList}>
            {[...agreed, ...paid].map((r) => (
              <li key={r.id}>
                <Link href={href(r)} className={s.rewardRow}>
                  <span>
                    <span className="cell-main">{project(r)}</span>
                    <span className="cell-sub">
                      {r.id} · {r.confirmed} confirmed
                    </span>
                  </span>
                  <span className={s.rewardAmt}>
                    <span className="num cell-main">{bot(r.reward ?? 0)}</span>
                    <span className="cell-sub">{r.status === "paid" ? "Paid" : "Agreed, not yet paid"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className={s.paidLine}>
            Paid to you so far <span className="num">{bot(paidTotal)} BOT</span>
          </p>
        </section>
      </div>

      <div className={`section-gap tabs`} role="tablist" aria-label="Report status">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            <span className="count">{inProg.filter(t.test).length}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <select className="select" aria-label="Programme" value={prog} onChange={(e) => setProg(e.target.value)}>
          <option value="all">All programmes</option>
          {programmes.map((id) => (
            <option key={id} value={id}>
              {nameOf(id)}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <span className="count-label">
          {shown.length} {shown.length === 1 ? "report" : "reports"}
        </span>
        <select className="select" aria-label="Sort" value={order} onChange={(e) => setOrder(e.target.value as "updated" | "submitted")}>
          <option value="updated">Recently updated</option>
          <option value="submitted">Recently submitted</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="empty">No reports in this view.</p>
      ) : (
        <>
          <table className={`table ${s.table}`}>
            <thead>
              <tr>
                <th>Report</th>
                <th>Severity</th>
                <th>Status</th>
                <th className="num">Reward</th>
                <th className="num">Updated</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const st = REPORT_STATUS[r.status];
                return (
                  <tr key={r.id} className="clickable" onClick={() => router.push(href(r))}>
                    <td className={s.ident}>
                      <Link href={href(r)} className="cell-main" onClick={(e) => e.stopPropagation()}>
                        {r.title}
                      </Link>
                      <div className="cell-sub">
                        <span className="num">{r.id}</span> · {project(r)}
                      </div>
                    </td>
                    <td>
                      <span className={s.sevSuggested}>{r.suggested}</span>
                      <div className="cell-sub">{r.confirmed ? `${r.confirmed} confirmed` : "Not confirmed yet"}</div>
                    </td>
                    <td>
                      <span className={pillClass(st.tone)}>{st.label}</span>
                      {r.reason && <div className={`cell-sub ${s.reason}`}>{r.reason}</div>}
                    </td>
                    <td className="num">
                      {r.reward ? (
                        <>
                          {bot(r.reward)}
                          <span className="unit">BOT</span>
                        </>
                      ) : (
                        <span className="dash">—</span>
                      )}
                      {r.payoutTx && (
                        <div className="cell-sub" onClick={(e) => e.stopPropagation()}>
                          <Hash value={r.payoutTx} href={txUrl(r.payoutTx)} />
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {r.updated}
                      <div className="cell-sub">{age(r.updated)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ul className={s.list}>
            {shown.map((r) => {
              const st = REPORT_STATUS[r.status];
              return (
                <li key={r.id}>
                  <Link href={href(r)} className={s.item}>
                    <span className={s.line1}>
                      <span className="cell-main">{r.title}</span>
                      <span className="num">{r.reward ? `${bot(r.reward)} BOT` : <span className="dash">—</span>}</span>
                    </span>
                    <span className={s.line2}>
                      <span>
                        {r.id} · {project(r)} · {r.confirmed ? `${r.confirmed} confirmed` : `${r.suggested} suggested`}
                      </span>
                      <span className={pillClass(st.tone)}>{st.label}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
