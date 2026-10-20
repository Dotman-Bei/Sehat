import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Manage, { type LiveQueue } from "./Manage";
import { REPORTS_LIVE } from "@/lib/config";
import { summaryToReport, type ApiSummary } from "@/lib/live-report";
import { findProgramme } from "@/lib/programmes";

type Params = { programId: string };

// Escrow figures and status come from the contract on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await findProgramme((await params).programId);
  return { title: p ? `Manage ${p.project} · Sehat` : "Manage · Sehat" };
}

export default async function ManagePage({ params }: { params: Promise<Params> }) {
  const p = await findProgramme((await params).programId);
  if (!p) notFound();
  if (!REPORTS_LIVE || !p.onChain) return <Manage programme={p} />;

  // Live: the queue is loaded for the signed-in wallet only if it is the owner or a triager.
  const { sessionFromCookies } = await import("@/server/auth");
  const { listForProgramme, listTriagers, teamRole } = await import("@/server/reports");
  const who = await sessionFromCookies();
  const id = p.onChain.programmeId;
  const team = who ? await teamRole(id, who) : null;
  const summaries = team ? ((await listForProgramme(id, who!)) as ApiSummary[]) : [];
  const live: LiveQueue = {
    signedIn: !!team,
    reports: summaries.map(summaryToReport),
    keys: Object.fromEntries(summaries.map((r) => [r.ref, r.id])),
    triagers: team ? listTriagers(id) : [],
  };
  // Keyed on the session and queue so client state is rebuilt after sign-in or a change.
  return <Manage key={`${who}-${live.signedIn}-${live.reports.length}-${live.triagers.length}`} programme={p} live={live} />;
}
