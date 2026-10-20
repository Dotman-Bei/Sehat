import { requireSession } from "@/server/auth";
import { fail, handle, json, requireLive } from "@/server/http";
import { addAttachment } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  requireLive();
  const who = requireSession(req);
  if (Number(req.headers.get("content-length") ?? 0) > 11 * 1024 * 1024) fail(413, "Files can be at most 10 MB.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) fail(400, "Attach one file in the 'file' field.");
  return json(await addAttachment((await params).id, who, file as File), { status: 201 });
});
