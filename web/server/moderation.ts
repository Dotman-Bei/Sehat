import "server-only";
import { ACTIVE_NETWORK } from "@/lib/config";
import { db } from "./db";

/** Programmes hidden from the directory by moderation (their escrow and pages are untouched). */
export async function hiddenProgrammeIds(): Promise<number[]> {
  return (await (await db()).all("SELECT programme_id FROM hidden_programmes WHERE chain_id = ?", ACTIVE_NETWORK.chainId) as { programme_id: number }[]).map(
    (r) => r.programme_id,
  );
}
