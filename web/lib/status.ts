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
