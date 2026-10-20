import { requireSession } from "@/server/auth";
import { handle, requireLive } from "@/server/http";
import { readAttachment } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloads only, never rendered inline: attachments are untrusted. */
export const GET = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  requireLive();
  const who = requireSession(req);
  const a = await readAttachment((await params).id, who);
  return new Response(new Uint8Array(a.bytes), {
    headers: {
      "Content-Type": a.mime,
      "Content-Disposition": `attachment; filename="${a.name.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Cache-Control": "private, no-store",
    },
  });
});
