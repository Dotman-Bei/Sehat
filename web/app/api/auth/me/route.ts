import { session } from "@/server/auth";
import { handle, json, requireLive } from "@/server/http";
import { isAdmin } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  requireLive();
  const address = session(req);
  return json({ address, admin: isAdmin(address) });
});
