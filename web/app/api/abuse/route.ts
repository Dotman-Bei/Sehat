import { requireSession } from "@/server/auth";
import { handle, json, readJson, requireLive } from "@/server/http";
import { createAbuse, listAbuse } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  requireLive();
  return json(await listAbuse(requireSession(req)));
});

export const POST = handle(async (req) => {
  requireLive();
  const who = requireSession(req);
  const body = await readJson<{ targetKind: string; target: string; reason: string }>(req);
  return json(await createAbuse(who, body), { status: 201 });
});
