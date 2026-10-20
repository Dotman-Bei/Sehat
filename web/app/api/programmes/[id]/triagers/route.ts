import { requireSession } from "@/server/auth";
import { fail, handle, json, readJson, requireLive } from "@/server/http";
import { addTriager, listTriagers, removeTriager, teamRole } from "@/server/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type P = { params: Promise<{ id: string }> };
const idOf = async (params: P["params"]) => {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) fail(404, "Unknown programme.");
  return id;
};

export const GET = handle(async (req, { params }: P) => {
  requireLive();
  const who = requireSession(req);
  const id = await idOf(params);
  if (!(await teamRole(id, who))) fail(403, "Only the programme team can see its triagers.");
  return json({ triagers: listTriagers(id) });
});

export const POST = handle(async (req, { params }: P) => {
  requireLive();
  const who = requireSession(req);
  const { wallet, name } = await readJson<{ wallet?: string; name?: string }>(req);
  return json({ triagers: await addTriager(await idOf(params), who, String(wallet ?? ""), String(name ?? "")) });
});

export const DELETE = handle(async (req, { params }: P) => {
  requireLive();
  const who = requireSession(req);
  const wallet = new URL(req.url).searchParams.get("wallet") ?? "";
  return json({ triagers: await removeTriager(await idOf(params), who, wallet) });
});
