import { requireSession } from "@/server/auth";
import { handle, json, readJson, requireLive } from "@/server/http";
import { confirmPaid } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Records a payout after checking the RewardReleased event in the transaction's receipt. */
export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  requireLive();
  const who = requireSession(req);
  const { txHash } = await readJson<{ txHash?: string }>(req);
  return json(await confirmPaid((await params).id, who, String(txHash ?? "")));
});
