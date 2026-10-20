import "server-only";
import { ACTIVE_NETWORK } from "@/lib/config";
import { db } from "./db";

/** Programmes hidden from the directory by moderation (their escrow and pages are untouched). */
export function hiddenProgrammeIds(): number[] {
  return (db().prepare("SELECT programme_id FROM hidden_programmes WHERE chain_id = ?").all(ACTIVE_NETWORK.chainId) as { programme_id: number }[]).map(
    (r) => r.programme_id,
  );
}
