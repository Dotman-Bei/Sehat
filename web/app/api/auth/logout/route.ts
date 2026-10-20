import { clearCookie } from "@/server/auth";
import { handle, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async () => json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } }));
