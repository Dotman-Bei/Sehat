import { requireSession } from "@/server/auth";
import { fail, handle, json, readJson, requireLive } from "@/server/http";
import { createReport, listForProgramme, listMine } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ?mine=1 for the signed-in researcher's reports; ?programme=<id> for a programme's team. */
export const GET = handle(async (req) => {
  requireLive();
  const who = requireSession(req);
  const q = new URL(req.url).searchParams;
  if (q.get("mine")) return json({ reports: listMine(who) });
  const programme = Number(q.get("programme"));
  if (!Number.isInteger(programme) || programme < 1) fail(400, "Ask for ?mine=1 or ?programme=<id>.");
  return json({ reports: await listForProgramme(programme, who) });
});

export const POST = handle(async (req) => {
  requireLive();
  const who = requireSession(req);
  const body = await readJson<Parameters<typeof createReport>[1]>(req, 128 * 1024);
  return json(await createReport(who, body), { status: 201 });
});
