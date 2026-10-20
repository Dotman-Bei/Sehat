import type { Programme, ReportStatus } from "./sample-data";
import { balance } from "./sample-data";

export const REPORT_STATUS: Record<ReportStatus, { label: string; tone: "" | "positive" | "negative" | "notice" | "muted" }> = {
  submitted: { label: "Submitted", tone: "" },
  triage: { label: "Triage", tone: "" },
  needs_information: { label: "Needs information", tone: "notice" },
  duplicate: { label: "Duplicate", tone: "muted" },
  out_of_scope: { label: "Out of scope", tone: "muted" },
  invalid: { label: "Invalid", tone: "muted" },
  accepted: { label: "Accepted", tone: "" },
  reward_agreed: { label: "Reward agreed", tone: "" },
  paid: { label: "Paid", tone: "positive" },
};

export const CLOSED_WITHOUT_REWARD: ReportStatus[] = ["duplicate", "out_of_scope", "invalid"];
export const OPEN: ReportStatus[] = ["submitted", "triage", "needs_information"];
export const ACCEPTED: ReportStatus[] = ["accepted", "reward_agreed", "paid"];

export function programmeState(p: Programme): { label: string; tone: "" | "positive" | "negative" | "notice" | "muted" } {
  if (p.status === "active" && balance(p) === 0) return { label: "Escrow empty", tone: "negative" };
  switch (p.status) {
    case "active":
      return { label: "Active", tone: "" };
    case "paused":
      return { label: "Paused", tone: "notice" };
    case "closing":
      return { label: "Closing", tone: "notice" };
    case "closed":
      return { label: "Closed", tone: "muted" };
    default:
      return { label: "Draft", tone: "muted" };
  }
}

export const pillClass = (tone: string) => `pill${tone ? ` pill-${tone}` : ""}`;

/** Why a researcher cannot start a reward-bearing report here, or null if they can. */
export function blockedReason(p: Programme): string | null {
  if (p.onChain && p.onChain.metadataStatus !== "verified")
    return "Its public scope and rules could not be verified against the hash recorded on-chain, so reports are not accepted.";
  if (p.test) return "This is a labelled test programme. It does not accept reports.";
  if (p.status === "paused") return "Paused by the owner. New reports are not accepted until it resumes.";
  if (p.status === "closing") return "Closing. Reports already submitted keep their payout window; new ones are not accepted.";
  if (p.status === "closed") return "Closed. Its reports and payout history stay visible.";
  if (p.status === "draft") return "Not published yet.";
  if (balance(p) === 0) return "Escrow is empty. Reward-bearing reports open again when the owner adds funds.";
  return null;
}


/** "Quayside Bridge relayer…", without repeating the project when the title already starts with it. */
export const programmeName = (p: { project: string; title: string }) =>
  p.title.toLowerCase().startsWith(p.project.toLowerCase()) ? p.title : `${p.project} ${p.title}`;
