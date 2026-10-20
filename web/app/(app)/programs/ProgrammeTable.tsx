"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { bot } from "@/lib/format";
import { pillClass } from "@/lib/status";
import type { ProgrammeStatus } from "@/lib/sample-data";
import s from "./programs.module.css";

export type Row = {
  id: string;
  project: string;
  title: string;
  status: ProgrammeStatus;
  state: { label: string; tone: string };
  scope: string[];
  critical: number;
  escrow: number;
  funded: number;
  paid: number;
  updated: string;
  updatedAge: string;
  accepting: boolean;
};

const TABS: { id: ProgrammeStatus | "all"; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
  { id: "closing", label: "Closing" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

const SORTS = {
  escrow: { label: "Most in escrow", fn: (a: Row, b: Row) => b.escrow - a.escrow },
  newest: { label: "Recently funded or paid", fn: (a: Row, b: Row) => b.updated.localeCompare(a.updated) },
  critical: { label: "Highest critical reward", fn: (a: Row, b: Row) => b.critical - a.critical },
};

export default function ProgrammeTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("active");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof typeof SORTS>("escrow");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => tab === "all" || r.status === tab)
      .filter((r) => !needle || [r.project, r.title, ...r.scope].some((t) => t.toLowerCase().includes(needle)))
      .sort(SORTS[sort].fn);
  }, [rows, tab, q, sort]);

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Programme status">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            <span className="count">{counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input
          className="input search"
          type="search"
          placeholder="Search by project or target"
          aria-label="Search programmes"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="spacer" />
        <span className="count-label">
          {shown.length} {shown.length === 1 ? "programme" : "programmes"}
        </span>
        <select className="select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}>
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="empty">
          {q ? `No programme matches “${q}”. Search covers project names, titles and in-scope targets.` : "No programmes in this state."}
        </p>
      ) : (
        <>
          <table className={`table ${s.table}`}>
            <thead>
              <tr>
                <th>Programme</th>
                <th className={s.scope}>In scope</th>
                <th className="num">Critical up to</th>
                <th className="num">In escrow</th>
                <th className="num">Last escrow event</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => router.push(`/programs/${r.id}`)}>
                  <td className={s.ident}>
                    <Link href={`/programs/${r.id}`} className="cell-main" onClick={(e) => e.stopPropagation()}>
                      {r.project}
                    </Link>
                    <div className="cell-sub">{r.title}</div>
                    <div className={`cell-sub ${s.scopeSub}`}>
                      {r.scope.slice(0, 2).join(", ")}
                      {r.scope.length > 2 && ` +${r.scope.length - 2}`}
                    </div>
                  </td>
                  <td className={s.scope}>
                    {r.scope.slice(0, 2).join(", ")}
                    {r.scope.length > 2 && <span className="dash"> +{r.scope.length - 2}</span>}
                  </td>
                  <td className="num">
                    {bot(r.critical)}
                    <span className="unit">BOT</span>
                  </td>
                  <td className="num">
                    <span className="cell-main">{bot(r.escrow)}</span>
                    <span className="unit">BOT</span>
                    <Track r={r} />
                    <div className="cell-sub">
                      {r.accepting ? `of ${bot(r.funded)} funded` : r.escrow === 0 && r.status === "active" ? "Not accepting reward-bearing reports" : `of ${bot(r.funded)} funded`}
                    </div>
                  </td>
                  <td className="num">
                    {r.updated}
                    <div className="cell-sub">{r.updatedAge}</div>
                  </td>
                  <td>
                    <span className={pillClass(r.state.tone)}>{r.state.label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className={s.list}>
            {shown.map((r) => (
              <li key={r.id}>
                <Link href={`/programs/${r.id}`} className={s.item}>
                  <span className={s.line1}>
                    <span className="cell-main">{r.project}</span>
                    <span className="num">
                      {bot(r.escrow)}
                      <span className="unit">BOT</span>
                    </span>
                  </span>
                  <span className={s.line2}>
                    <span>
                      {r.title} · critical up to {bot(r.critical)}
                    </span>
                    <span className={pillClass(r.state.tone)}>{r.state.label}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Track({ r }: { r: Row }) {
  if (!r.funded) return null;
  const out = r.funded - r.paid - r.escrow;
  return (
    <div className={`track track-thin ${s.track}`} aria-hidden>
      {r.paid > 0 && <span className="t-paid" style={{ width: `${(r.paid / r.funded) * 100}%` }} />}
      {out > 0 && <span className="t-out" style={{ width: `${(out / r.funded) * 100}%` }} />}
      {r.escrow > 0 && <span className="t-left" style={{ width: `${(r.escrow / r.funded) * 100}%` }} />}
    </div>
  );
}
