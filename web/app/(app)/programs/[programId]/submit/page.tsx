import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReportForm from "./ReportForm";
import { findProgramme } from "@/lib/programmes";
import { blockedReason } from "@/lib/status";
import { short } from "@/lib/format";
import { REPORTS_LIVE } from "@/lib/config";
import SignInPanel from "@/components/app/SignIn";

type Params = { programId: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await findProgramme((await params).programId);
  return { title: p ? `Report to ${p.project} · Sehat` : "Submit report · Sehat" };
}

export default async function SubmitPage({ params }: { params: Promise<Params> }) {
  const p = await findProgramme((await params).programId);
  if (!p) notFound();
  const blocked = blockedReason(p);
  // Live: reports are tied to a signed-in wallet, so sign in before writing one.
  const signedIn = REPORTS_LIVE ? !!(await (await import("@/server/auth")).sessionFromCookies()) : true;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Report to {p.project}</h1>
          <p className="subline">
            Private to the {p.project} team and the triagers they authorise. Nothing you write here is put on-chain.
          </p>
        </div>
      </div>

      {blocked ? (
        <section className="panel" style={{ maxWidth: 720 }}>
          <div className="panel-head">
            <h2>This programme is not taking reports</h2>
          </div>
          <p>{blocked}</p>
          <p style={{ marginTop: 16 }}>
            <Link className="btn" href={`/programs/${p.id}`}>
              Back to {p.project}
            </Link>
          </p>
        </section>
      ) : !signedIn ? (
        <SignInPanel sentence={`Sign in with your wallet to report privately to ${p.project}. The report is tied to that wallet, and only you and the ${p.project} team can read it.`} />
      ) : (
        <ReportForm
          programme={{
            id: p.id,
            project: p.project,
            owner: short(p.owner),
            triagers: p.triagers.map((t) => t.name),
            scope: p.scope.map((s) => s.target),
            tiers: p.tiers.map((t) => ({ severity: t.severity, min: t.min, max: t.max })),
          }}
        />
      )}
    </>
  );
}
