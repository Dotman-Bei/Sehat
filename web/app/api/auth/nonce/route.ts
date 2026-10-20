import { issueNonce } from "@/server/auth";
import { handle, json, requireLive } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  requireLive();
  return json({ nonce: issueNonce(req) });
});
