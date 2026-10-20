import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReportView from "./ReportView";
import { REPORTS, getReport } from "@/lib/sample-data";

type Params = { reportId: string };

export function generateStaticParams() {
  return REPORTS.map((r) => ({ reportId: r.id }));
}

// The title names only the reference: report titles are private.
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return { title: `${(await params).reportId} · Sehat` };
}

export default async function ReportPage({ params }: { params: Promise<Params> }) {
  const { reportId } = await params;
  if (!getReport(reportId)) notFound();
  return <ReportView reportId={reportId} />;
}
