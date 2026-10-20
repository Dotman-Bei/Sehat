import { requireSession } from "@/server/auth";
import { handle, json, readJson, requireLive } from "@/server/http";
import { addMessage } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  requireLive();
  const who = requireSession(req);
  const { body, teamOnly } = await readJson<{ body?: string; teamOnly?: boolean }>(req);
  return json(await addMessage((await params).id, who, body, teamOnly));
});
