import type { Metadata } from "next";
import ResearcherDashboard, { type LiveReports } from "./ResearcherDashboard";
import SignInPanel from "@/components/app/SignIn";
import { REPORTS_LIVE } from "@/lib/config";
import { detailToReport, summaryToReport, type ApiDetail, type ApiSummary } from "@/lib/live-report";

export const metadata: Metadata = { title: "Your reports · Sehat" };
export const dynamic = "force-dynamic";

export default async function ResearcherPage() {
  if (!REPORTS_LIVE) return <ResearcherDashboard />;

  const { sessionFromCookies } = await import("@/server/auth");
  const { listMine, getReport } = await import("@/server/reports");
  const { listProgrammes } = await import("@/lib/programmes");
  const who = await sessionFromCookies();
  if (!who) {
    return (
      <>
        <div className="title-row">
          <div>
            <h1>Your reports</h1>
          </div>
        </div>
        <SignInPanel sentence="Sign in with your wallet to see the reports you submitted from it. Reports are private, so nothing shows here until you do." />
      </>
    );
  }

  const summaries = listMine(who) as ApiSummary[];
  // The team's latest question is shown on the dashboard, so load the thread of reports that wait on the researcher.
  const reports = await Promise.all(
    summaries.map(async (sum) =>
      sum.status === "needs_information" ? detailToReport((await getReport(sum.id, who)) as ApiDetail).report : { ...summaryToReport(sum), reporter: who },
    ),
  );
  const programmes = await listProgrammes();
  const live: LiveReports = {
    reports,
    keys: Object.fromEntries(summaries.map((s) => [s.ref, s.id])),
    names: Object.fromEntries(programmes.map((p) => [p.id, p.project])),
  };
  return <ResearcherDashboard live={live} />;
}
