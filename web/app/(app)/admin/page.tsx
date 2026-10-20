import type { Metadata } from "next";
import Admin, { type LiveModeration } from "./Admin";
import { listProgrammes } from "@/lib/programmes";
import { REPORTS_LIVE } from "@/lib/config";
import { isoDate } from "@/lib/live-report";

export const metadata: Metadata = { title: "Moderation · Sehat" };
export const dynamic = "force-dynamic";

const stamp = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 16).replace("T", " ");

export default async function AdminPage() {
  const programmes = await listProgrammes();
  if (!REPORTS_LIVE) return <Admin programmes={programmes} />;

  const { sessionFromCookies } = await import("@/server/auth");
  const { isAdmin, listAbuse } = await import("@/server/reports");
  const who = await sessionFromCookies();
  const admin = isAdmin(who);
  let live: LiveModeration = { signedIn: !!who, admin, queue: [], audit: [], counts: { reports: 0, open: 0, accepted: 0, researchers: 0 } };
  if (admin) {
    const data = listAbuse(who!) as {
      queue: { id: string; targetKind: "programme" | "report"; target: string; reason: string; reporter: string; status: "open" | "hidden" | "dismissed"; at: number }[];
      audit: { at: number; actor: string; action: string; target: string; reason: string | null }[];
      counts: { reports: number; open: number | null; accepted: number | null; researchers: number };
    };
    live = {
      ...live,
      queue: data.queue.map((q) => ({ id: q.id, target: q.target, targetKind: q.targetKind, reason: q.reason, reporter: q.reporter, date: isoDate(q.at), status: q.status })),
      audit: data.audit.map((a) => ({ date: stamp(a.at), actor: a.actor, action: a.action, target: a.target, reason: a.reason ?? "" })),
      counts: { reports: data.counts.reports ?? 0, open: data.counts.open ?? 0, accepted: data.counts.accepted ?? 0, researchers: data.counts.researchers ?? 0 },
    };
  }
  // Keyed on the data so client state is rebuilt after sign-in or a decision.
  return <Admin key={`${who}-${live.admin}-${live.queue.map((q) => q.status).join("")}-${live.audit.length}`} programmes={programmes} live={live} />;
}
