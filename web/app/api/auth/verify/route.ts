import { sessionCookie, verifySignIn } from "@/server/auth";
import { fail, handle, json, readJson, requireLive } from "@/server/http";
import { isAdmin } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  requireLive();
  const { message, signature } = await readJson<{ message?: string; signature?: string }>(req, 8 * 1024);
  if (typeof message !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature ?? "")) fail(400, "Send the signed sign-in message.");
  const address = await verifySignIn(req, message!, signature as `0x${string}`);
  return json({ address, admin: isAdmin(address) }, { headers: { "Set-Cookie": sessionCookie(req, address) } });
});
