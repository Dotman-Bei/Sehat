import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReportView from "./ReportView";
import SignInPanel from "@/components/app/SignIn";
import { REPORTS, getProgramme, getReport } from "@/lib/sample-data";
import { REPORTS_LIVE } from "@/lib/config";
import { findProgramme } from "@/lib/programmes";
import { detailToReport, type ApiDetail } from "@/lib/live-report";

type Params = { reportId: string };

// Live: rendered per request for the signed-in wallet. Preview: sample reports.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return REPORTS_LIVE ? [] : REPORTS.map((r) => ({ reportId: r.id }));
}

// The title never names the report: titles are private.
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return { title: REPORTS_LIVE ? "Private report · Sehat" : `${(await params).reportId} · Sehat` };
}

function Locked({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="title-row">
        <div>
          <h1>Private report</h1>
          <p className="subline">Visible only to the researcher who submitted it and the programme&rsquo;s team.</p>
        </div>
      </div>
      {children}
    </>
  );
}

export default async function ReportPage({ params }: { params: Promise<Params> }) {
  const { reportId } = await params;

  if (!REPORTS_LIVE) {
    const report = getReport(reportId);
    if (!report) notFound();
    return <ReportView report={report!} programme={getProgramme(report!.programmeId)!} />;
  }

  const { sessionFromCookies } = await import("@/server/auth");
  const { getReport: loadReport } = await import("@/server/reports");
  const who = await sessionFromCookies();
  if (!who) {
    return (
      <Locked>
        <SignInPanel sentence="Sign in with the wallet that submitted this report, or a wallet on the programme's team." />
      </Locked>
    );
  }

  let detail: ApiDetail;
  try {
    detail = (await loadReport(reportId, who)) as ApiDetail;
  } catch {
    // Same answer whether the report is missing or belongs to someone else.
    return (
      <Locked>
        <p className="empty" style={{ maxWidth: 720 }}>
          No report here for the signed-in wallet. Reports are private to their researcher and the programme&rsquo;s team.
        </p>
      </Locked>
    );
  }

  const programme = await findProgramme(String(detail.programmeId));
  if (!programme) notFound();
  const { report, live } = detailToReport(detail);
  return <ReportView key={`${detail.id}-${detail.updated}-${detail.messages.length}`} report={report} programme={programme!} live={live} />;
}
