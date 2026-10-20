import { requireSession } from "@/server/auth";
import { handle, json, readJson, requireLive } from "@/server/http";
import { triage } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  requireLive();
  const who = requireSession(req);
  const body = await readJson<{ status: string; reason?: string; confirmed?: string; reward?: string }>(req);
  return json(await triage((await params).id, who, body));
});
