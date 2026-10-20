import { requireSession } from "@/server/auth";
import { handle, json, requireLive } from "@/server/http";
import { getReport } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  requireLive();
  const who = requireSession(req);
  return json(await getReport((await params).id, who));
});
