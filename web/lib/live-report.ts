// Shapes a report from the private reports API into the Report shape the screens already render.
// Pure: safe on the server and in the browser.

import type { Report, ReportStatus, Severity } from "./sample-data";

export type ApiMessage = { author: string; role: string; teamOnly: boolean; body: string; at: number };
export type ApiAttachment = { id: string; name: string; mime: string; size: number; created_at: number };
export type ApiSummary = {
  id: string;
  ref: string;
  programmeId: number;
  title: string;
  target: string;
  suggested: Severity;
  confirmed: Severity | null;
  status: ReportStatus;
  reason: string | null;
  reward: string | null;
  payoutTx: string | null;
  submitted: number;
  updated: number;
  reporter?: string;
};
export type ApiDetail = ApiSummary & {
  role: "researcher" | "owner" | "triager";
  category: string;
  impact: string;
  steps: string;
  reporter: string;
  payoutWallet: string;
  digest: string;
  payoutBlock: number | null;
  messages: ApiMessage[];
  attachments: ApiAttachment[];
};

/** What the live screens need beyond the Report shape. */
export type LiveExtra = {
  key: string; // the random id used in links and API paths
  role: "researcher" | "owner" | "triager";
  programmeId: number;
  payoutWallet: string;
  rewardText: string | null; // exact decimal, used for the release transaction
  attachmentIds: string[];
};

export const isoDate = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function summaryToReport(d: ApiSummary): Report {
  return {
    id: d.ref,
    programmeId: String(d.programmeId),
    reporter: d.reporter ?? "",
    title: d.title,
    category: "",
    target: d.target,
    suggested: d.suggested,
    confirmed: d.confirmed ?? undefined,
    status: d.status,
    submitted: isoDate(d.submitted),
    updated: isoDate(d.updated),
    reward: d.reward ? Number(d.reward) : undefined,
    reason: d.reason ?? undefined,
    digest: "",
    payoutTx: d.payoutTx ?? undefined,
    impact: "",
    steps: [],
    attachments: [],
    thread: [],
  };
}

export function detailToReport(d: ApiDetail): { report: Report; live: LiveExtra } {
  return {
    report: {
      ...summaryToReport(d),
      reporter: d.reporter,
      category: d.category,
      digest: d.digest,
      payoutBlock: d.payoutBlock ?? undefined,
      impact: d.impact,
      steps: d.steps
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean),
      attachments: d.attachments.map((a) => ({ name: a.name, size: size(a.size) })),
      thread: d.messages.map((m) => ({
        from: m.role === "team" ? "team" : "researcher",
        author: m.author,
        date: isoDate(m.at),
        body: m.body,
        teamOnly: m.teamOnly,
      })),
    },
    live: {
      key: d.id,
      role: d.role,
      programmeId: d.programmeId,
      payoutWallet: d.payoutWallet,
      rewardText: d.reward,
      attachmentIds: d.attachments.map((a) => a.id),
    },
  };
}

/** POSTs JSON to the reports API and returns the parsed body, or throws with the server's sentence. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "The request failed.");
  return data as T;
}
