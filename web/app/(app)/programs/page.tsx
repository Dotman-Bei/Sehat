import type { Metadata } from "next";
import Link from "next/link";
import ProgrammeTable, { type Row } from "./ProgrammeTable";
import { PROGRAMMES, acceptsRewards, balance, funded, lastUpdated, maxCritical, paidOut } from "@/lib/sample-data";
import { programmeState } from "@/lib/status";
import { age, bot } from "@/lib/format";

export const metadata: Metadata = { title: "Programmes · Sehat" };

export default function ProgrammesPage() {
  const rows: Row[] = PROGRAMMES.map((p) => ({
    id: p.id,
    project: p.project,
    title: p.title,
    status: p.status,
    state: programmeState(p),
    scope: p.scope.map((s) => s.target),
    critical: maxCritical(p),
    escrow: balance(p),
    funded: funded(p),
    paid: paidOut(p),
    updated: lastUpdated(p),
    updatedAge: age(lastUpdated(p)),
    accepting: acceptsRewards(p),
  }));
  const accepting = rows.filter((r) => r.accepting);
  const total = rows.reduce((t, r) => t + r.escrow, 0);
  const newest = [...PROGRAMMES].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Programmes</h1>
          <p className="subline">
            <strong>{accepting.length} of {rows.length}</strong> accept reward-bearing reports, with{" "}
            <strong className="num">{bot(total)} BOT</strong> in escrow. {newest.project} opened{" "}
            {age(newest.startDate).toLowerCase()} ago.
          </p>
        </div>
        <div className="title-actions">
          <Link href="/programs/create" className="btn btn-primary">
            Start a programme
          </Link>
        </div>
      </div>
      <ProgrammeTable rows={rows} />
    </>
  );
}
