import { requireSession } from "@/server/auth";
import { handle, json, readJson, requireLive } from "@/server/http";
import { decideAbuse } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  requireLive();
  const who = requireSession(req);
  const { action, reason } = await readJson<{ action?: string; reason?: string }>(req);
  return json(decideAbuse(who, (await params).id, String(action ?? ""), String(reason ?? "")));
});
