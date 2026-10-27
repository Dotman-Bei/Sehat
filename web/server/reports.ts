import "server-only";
// The private reports service: every read and write goes through an access check here.

import { randomBytes } from "node:crypto";
import path from "node:path";
import { decodeEventLog, encodeAbiParameters, keccak256, parseEther, type Hex } from "viem";
import { ESCROW_ABI } from "@/lib/escrow-abi";
import { publicClient, readProgramme } from "@/lib/chain";
import { ACTIVE_NETWORK, ESCROW_ADDRESS } from "@/lib/config";
import { SEVERITIES, type Severity } from "@/lib/sample-data";
import { blockedReason } from "@/lib/status";
import { findProgramme } from "@/lib/programmes";
import { db, now, tx, type Q } from "./db";
import { fail, rateLimit } from "./http";

const CHAIN = ACTIVE_NETWORK.chainId;
export const CATEGORIES = [
  "Access control",
  "Arithmetic / rounding",
  "Oracle / price manipulation",
  "Replay / signature reuse",
  "Reentrancy",
  "State / accounting",
  "Logic halt (not load testing)",
  "UI misrepresentation",
  "Off-chain service",
  "Other",
];
export const NOT_LISTED = "__not_listed";
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export type Role = "researcher" | "owner" | "triager";
export type ReportStatus =
  | "submitted"
  | "triage"
  | "needs_information"
  | "duplicate"
  | "out_of_scope"
  | "invalid"
  | "reward_agreed"
  | "paid";

type Row = {
  id: string;
  ref: string;
  chain_id: number;
  programme_id: number;
  reporter: string;
  title: string;
  category: string;
  target: string;
  suggested: Severity;
  confirmed: Severity | null;
  status: ReportStatus;
  reason: string | null;
  reward: string | null;
  impact: string;
  steps: string;
  payout_wallet: string;
  salt: string;
  digest: string;
  payout_tx: string | null;
  payout_block: number | null;
  created_at: number;
  updated_at: number;
};

// ---------------------------------------------------------------- roles

const ownerCache = new Map<number, { owner: string; at: number }>();
export async function programmeOwner(programmeId: number): Promise<string | null> {
  const hit = ownerCache.get(programmeId);
  if (hit && Date.now() - hit.at < 15_000) return hit.owner;
  const p = await readProgramme(programmeId);
  if (!p) return null;
  ownerCache.set(programmeId, { owner: p.owner.toLowerCase(), at: Date.now() });
  return p.owner.toLowerCase();
}

export const isTriager = async (programmeId: number, wallet: string) =>
  !!(await (await db()).get("SELECT 1 FROM triagers WHERE chain_id = ? AND programme_id = ? AND wallet = ?", CHAIN, programmeId, wallet));

export const isAdmin = (wallet: string | null) =>
  !!wallet && (process.env.SEHAT_ADMINS ?? "").toLowerCase().split(",").map((s) => s.trim()).includes(wallet);

export async function teamRole(programmeId: number, wallet: string): Promise<"owner" | "triager" | null> {
  if ((await programmeOwner(programmeId)) === wallet) return "owner";
  return (await isTriager(programmeId, wallet)) ? "triager" : null;
}

async function roleFor(r: Row, wallet: string): Promise<Role | null> {
  const team = await teamRole(r.programme_id, wallet);
  if (team) return team;
  return r.reporter === wallet ? "researcher" : null;
}

/** Loads a report the wallet may see. Others get the same 404 as a missing report, so existence never leaks. */
async function load(id: string, wallet: string): Promise<{ r: Row; role: Role }> {
  const r = await (await db()).get("SELECT * FROM reports WHERE id = ? AND chain_id = ?", id, CHAIN) as Row | undefined;
  const role = r ? await roleFor(r, wallet) : null;
  if (!r || !role) return fail(404, "Report not found.");
  return { r: r!, role: role! };
}

// ---------------------------------------------------------------- views

const summary = (r: Row) => ({
  id: r.id,
  ref: r.ref,
  programmeId: r.programme_id,
  title: r.title,
  target: r.target,
  suggested: r.suggested,
  confirmed: r.confirmed,
  status: r.status,
  reason: r.reason,
  reward: r.reward,
  payoutTx: r.payout_tx,
  submitted: r.created_at,
  updated: r.updated_at,
});

async function detail(r: Row, role: Role) {
  const team = role !== "researcher";
  const messages = await (await db()).all("SELECT author, role, team_only, body, created_at FROM messages WHERE report_id = ? ORDER BY id", r.id) as { author: string; role: string; team_only: number; body: string; created_at: number }[];
  const attachments = await (await db()).all("SELECT id, name, mime, size, created_at FROM attachments WHERE report_id = ? ORDER BY created_at", r.id) as {
    id: string;
    name: string;
    mime: string;
    size: number;
    created_at: number;
  }[];
  const history = await (await db()).all("SELECT status, actor, reason, at FROM report_history WHERE report_id = ? ORDER BY id", r.id) as {
    status: string;
    actor: string;
    reason: string | null;
    at: number;
  }[];
  return {
    ...summary(r),
    role,
    category: r.category,
    impact: r.impact,
    steps: r.steps,
    reporter: r.reporter,
    payoutWallet: r.payout_wallet,
    digest: r.digest,
    payoutBlock: r.payout_block,
    messages: messages
      .filter((m) => team || !m.team_only)
      .map((m) => ({ author: m.author, role: m.role, teamOnly: !!m.team_only, body: m.body, at: m.created_at })),
    attachments,
    history,
  };
}

// ---------------------------------------------------------------- create

type CreateInput = {
  programmeId: number;
  title: string;
  category: string;
  suggested: string;
  target: string;
  impact: string;
  steps: string;
  payoutWallet: string;
  confirm: boolean;
};

const text = (v: unknown, name: string, min: number, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < min) fail(400, `${name} needs at least ${min} characters.`);
  if (s.length > max) fail(400, `${name} can be at most ${max} characters.`);
  return s;
};

export async function createReport(wallet: string, input: CreateInput) {
  await rateLimit(`report:${wallet}`, 5, 3600);
  const programmeId = Number(input.programmeId);
  if (!Number.isInteger(programmeId) || programmeId < 1) fail(400, "Unknown programme.");
  const p = await findProgramme(String(programmeId));
  if (!p) fail(404, "Unknown programme.");
  const blocked = blockedReason(p!) ?? ((await isHidden(programmeId)) ? "This programme is hidden from the directory by moderation." : null);
  if (blocked) fail(409, blocked);

  const title = text(input.title, "Title", 8, 120);
  const impact = text(input.impact, "Impact", 40, 20_000);
  const steps = text(input.steps, "Reproduction steps", 40, 40_000);
  if (!CATEGORIES.includes(input.category)) fail(400, "Choose a category from the list.");
  if (!SEVERITIES.includes(input.suggested as Severity)) fail(400, "Choose a suggested severity.");
  const scope = p!.scope.map((s) => s.target);
  if (input.target !== NOT_LISTED && !scope.includes(input.target)) fail(400, "Choose the affected target from the programme's scope.");
  if (!ADDRESS.test(input.payoutWallet ?? "")) fail(400, "The payout wallet is not a valid address.");
  if (input.confirm !== true) fail(400, "Confirm that you followed the rules of engagement.");

  return tx(async (q) => {
    const count = (await q.get("SELECT COUNT(*) AS n FROM reports") as { n: number }).n;
    const ref = `SHT-${String(count + 1).padStart(4, "0")}`;
    const id = `r${randomBytes(12).toString("hex")}`;
    const salt = `0x${randomBytes(32).toString("hex")}` as Hex;
    const digest = keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes32" }], [ref, salt]));
    const t = now();
    await q.run(
        `INSERT INTO reports(id, ref, chain_id, programme_id, reporter, title, category, target, suggested, status, impact, steps, payout_wallet, salt, digest, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?)`, id, ref, CHAIN, programmeId, wallet, title, input.category, input.target === NOT_LISTED ? "Not listed in scope" : input.target, input.suggested, impact, steps, input.payoutWallet.toLowerCase(), salt, digest, t, t);
    await q.run("INSERT INTO report_history(report_id, status, actor, at) VALUES (?, 'submitted', ?, ?)", id, wallet, t);
    return { id, ref };
  });
}

// ---------------------------------------------------------------- read

export async function listMine(wallet: string) {
  const rows = await (await db()).all("SELECT * FROM reports WHERE reporter = ? AND chain_id = ? ORDER BY updated_at DESC", wallet, CHAIN) as Row[];
  return rows.map(summary);
}

export async function listForProgramme(programmeId: number, wallet: string) {
  if (!(await teamRole(programmeId, wallet))) fail(403, "Only the programme owner and its triagers can see its reports.");
  const rows = await (await db()).all("SELECT * FROM reports WHERE chain_id = ? AND programme_id = ? ORDER BY created_at", CHAIN, programmeId) as Row[];
  return rows.map((r) => ({ ...summary(r), reporter: r.reporter }));
}

export async function getReport(id: string, wallet: string) {
  const { r, role } = await load(id, wallet);
  return detail(r, role);
}

// ---------------------------------------------------------------- thread

export async function addMessage(id: string, wallet: string, body: unknown, teamOnly: unknown) {
  await rateLimit(`message:${wallet}`, 60, 3600);
  const { r, role } = await load(id, wallet);
  const text_ = text(body, "Message", 1, 10_000);
  const isTeam = role !== "researcher";
  if (teamOnly && !isTeam) fail(403, "Only the programme team can leave team-only notes.");
  const t = now();
  await (await db()).run("INSERT INTO messages(report_id, author, role, team_only, body, created_at) VALUES (?, ?, ?, ?, ?, ?)", r.id, wallet, isTeam ? "team" : "researcher", teamOnly && isTeam ? 1 : 0, text_, t);
  await (await db()).run("UPDATE reports SET updated_at = ? WHERE id = ?", t, r.id);
  return detail({ ...r, updated_at: t }, role);
}

// ---------------------------------------------------------------- triage

const NEEDS_REASON: ReportStatus[] = ["needs_information", "duplicate", "out_of_scope", "invalid"];
const DECIDABLE: ReportStatus[] = ["triage", "needs_information", "duplicate", "out_of_scope", "invalid", "reward_agreed"];
const OPEN: ReportStatus[] = ["submitted", "triage", "needs_information"];

export async function triage(
  id: string,
  wallet: string,
  input: { status: string; reason?: string; confirmed?: string; reward?: string },
) {
  const { r, role } = await load(id, wallet);
  if (role === "researcher") fail(403, "Only the programme team can triage.");
  const next = input.status as ReportStatus;
  if (!DECIDABLE.includes(next)) fail(400, "Unknown decision.");
  if (!OPEN.includes(r.status)) fail(409, `A report that is ${r.status.replace(/_/g, " ")} cannot be re-triaged.`);

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (NEEDS_REASON.includes(next) && reason.length < 10) fail(400, "Give the researcher a reason of at least 10 characters.");
  if (reason.length > 2000) fail(400, "The reason can be at most 2,000 characters.");

  let confirmed = r.confirmed;
  if (input.confirmed) {
    if (!SEVERITIES.includes(input.confirmed as Severity)) fail(400, "Unknown severity.");
    confirmed = input.confirmed as Severity;
  }

  let reward: string | null = r.reward;
  if (next === "reward_agreed") {
    if (role !== "owner") fail(403, "Only the programme owner can agree a reward.");
    if (!confirmed) fail(400, "Confirm a severity before agreeing a reward.");
    const amount = typeof input.reward === "string" ? input.reward.trim() : "";
    let wei: bigint;
    try {
      wei = parseEther(amount);
    } catch {
      return fail(400, "Enter the reward in BOT, for example 1.5.");
    }
    if (wei <= BigInt(0)) fail(400, "The reward must be above zero.");
    const p = await findProgramme(String(r.programme_id));
    const tier = p?.tiers.find((t) => t.severity === confirmed);
    if (tier && (Number(amount) < tier.min || Number(amount) > tier.max)) fail(400, `${confirmed} pays ${tier.min}–${tier.max} BOT on this programme.`);
    if (p?.onChain && Number(amount) > p.onChain.balance) fail(409, `Escrow holds ${p.onChain.balance} BOT; add funds before agreeing ${amount} BOT.`);
    reward = amount;
  }

  const t = now();
  await tx(async (q) => {
    await q.run("UPDATE reports SET status = ?, reason = ?, confirmed = ?, reward = ?, updated_at = ? WHERE id = ?", next, reason || null, confirmed, reward, t, r.id);
    await q.run("INSERT INTO report_history(report_id, status, actor, reason, at) VALUES (?, ?, ?, ?, ?)", r.id, next, wallet, reason || null, t);
  });
  const fresh = await (await db()).get("SELECT * FROM reports WHERE id = ?", r.id) as Row;
  return detail(fresh, role);
}

// ---------------------------------------------------------------- payout confirmation

/** Marks a report paid only after finding the matching RewardReleased event in a successful receipt. */
export async function confirmPaid(id: string, wallet: string, txHash: string) {
  const { r, role } = await load(id, wallet);
  if (r.status === "paid") return detail(r, role);
  if (r.status !== "reward_agreed" || !r.reward) fail(409, "Only an agreed reward can be marked paid.");
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) fail(400, "Not a transaction hash.");

  const receipt = await publicClient.getTransactionReceipt({ hash: txHash as Hex }).catch(() => null);
  if (!receipt) fail(404, "Transaction not found yet. Wait for it to be mined.");
  if (receipt!.status !== "success") fail(409, "That transaction reverted.");

  const want = parseEther(r.reward!);
  const match = receipt!.logs.some((log) => {
    if (log.address.toLowerCase() !== ESCROW_ADDRESS.toLowerCase()) return false;
    try {
      const ev = decodeEventLog({ abi: ESCROW_ABI, data: log.data, topics: log.topics });
      return (
        ev.eventName === "RewardReleased" &&
        Number(ev.args.programmeId) === r.programme_id &&
        ev.args.reportRef.toLowerCase() === r.digest.toLowerCase() &&
        ev.args.recipient.toLowerCase() === r.payout_wallet &&
        ev.args.amount === want
      );
    } catch {
      return false;
    }
  });
  if (!match) fail(409, "That transaction did not pay this report's agreed reward to its payout wallet.");

  const t = now();
  await tx(async (q) => {
    await q.run("UPDATE reports SET status = 'paid', payout_tx = ?, payout_block = ?, updated_at = ? WHERE id = ?", txHash.toLowerCase(), Number(receipt!.blockNumber), t, r.id);
    await q.run("INSERT INTO report_history(report_id, status, actor, at) VALUES (?, 'paid', ?, ?)", r.id, wallet, t);
  });
  return detail(await (await db()).get("SELECT * FROM reports WHERE id = ?", r.id) as Row, role);
}

// ---------------------------------------------------------------- attachments

const MAX_FILES = 5;
// Vercel functions take request bodies up to 4.5 MB, so files stop at 4 MB.
const MAX_BYTES = 4 * 1024 * 1024;

/** File type from the bytes, never from the name or the browser's claim. */
function sniff(b: Buffer): string | null {
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (!b.includes(0) && Buffer.from(b.toString("utf8"), "utf8").equals(b)) return "text/plain";
  return null;
}

const safeName = (n: string) => (path.basename(n).replace(/[^\w.\- ]+/g, "_").slice(0, 100) || "file");

export async function addAttachment(id: string, wallet: string, file: File) {
  await rateLimit(`upload:${wallet}`, 20, 3600);
  const { r } = await load(id, wallet);
  const count = (await (await db()).get("SELECT COUNT(*) AS n FROM attachments WHERE report_id = ?", r.id) as { n: number }).n;
  if (count >= MAX_FILES) fail(409, `A report can hold at most ${MAX_FILES} files.`);
  if (file.size > MAX_BYTES) fail(413, "Files can be at most 4 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime) fail(415, "Only PDF, PNG, JPEG and plain text files are accepted.");
  const attId = `a${randomBytes(12).toString("hex")}`;
  await (await db()).run("INSERT INTO attachments(id, report_id, name, mime, size, data, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", attId, r.id, safeName(file.name), mime, bytes.length, bytes, wallet, now());
  return { id: attId, name: safeName(file.name), mime, size: bytes.length };
}

export async function readAttachment(attId: string, wallet: string) {
  const a = await (await db()).get("SELECT report_id, name, mime, data FROM attachments WHERE id = ?", attId) as
    | { report_id: string; name: string; mime: string; data: Uint8Array }
    | undefined;
  if (!a) fail(404, "File not found.");
  await load(a!.report_id, wallet); // same access rule as the report
  return { name: a!.name, mime: a!.mime, bytes: Buffer.from(a!.data) };
}

// ---------------------------------------------------------------- triagers

export async function listTriagers(programmeId: number) {
  return await (await db()).all("SELECT wallet, name FROM triagers WHERE chain_id = ? AND programme_id = ? ORDER BY created_at", CHAIN, programmeId) as {
    wallet: string;
    name: string;
  }[];
}

export async function addTriager(programmeId: number, wallet: string, triager: string, name: string) {
  if ((await programmeOwner(programmeId)) !== wallet) fail(403, "Only the programme owner can add triagers.");
  if (!ADDRESS.test(triager)) fail(400, "Not a wallet address.");
  const label = text(name, "Name", 1, 60);
  if (triager.toLowerCase() === wallet) fail(400, "The owner already has access.");
  await (await db()).run("INSERT OR REPLACE INTO triagers(chain_id, programme_id, wallet, name, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?)", CHAIN, programmeId, triager.toLowerCase(), label, wallet, now());
  await audit(wallet, "Added triager", `programme ${programmeId}: ${triager.toLowerCase()}`, null);
  return listTriagers(programmeId);
}

export async function removeTriager(programmeId: number, wallet: string, triager: string) {
  if ((await programmeOwner(programmeId)) !== wallet) fail(403, "Only the programme owner can remove triagers.");
  await (await db()).run("DELETE FROM triagers WHERE chain_id = ? AND programme_id = ? AND wallet = ?", CHAIN, programmeId, triager.toLowerCase());
  await audit(wallet, "Removed triager", `programme ${programmeId}: ${triager.toLowerCase()}`, null);
  return listTriagers(programmeId);
}

// ---------------------------------------------------------------- moderation

export async function audit(actor: string, action: string, target: string, reason: string | null, q?: Q) {
  await (q ?? (await db())).run("INSERT INTO audit(at, actor, action, target, reason) VALUES (?, ?, ?, ?, ?)", now(), actor, action, target, reason);
}

export const isHidden = async (programmeId: number) =>
  !!(await (await db()).get("SELECT 1 FROM hidden_programmes WHERE chain_id = ? AND programme_id = ?", CHAIN, programmeId));

export async function hiddenProgrammeIds(): Promise<number[]> {
  return (await (await db()).all("SELECT programme_id FROM hidden_programmes WHERE chain_id = ?", CHAIN) as { programme_id: number }[]).map((r) => r.programme_id);
}

export async function createAbuse(wallet: string, input: { targetKind: string; target: string; reason: string }) {
  await rateLimit(`abuse:${wallet}`, 5, 24 * 3600);
  if (input.targetKind !== "programme" && input.targetKind !== "report") fail(400, "Report a programme or a report.");
  const target = text(input.target, "Target", 1, 80);
  const reason = text(input.reason, "Reason", 10, 2000);
  const id = `AB-${randomBytes(4).toString("hex")}`;
  await (await db()).run("INSERT INTO abuse(id, target_kind, target, reason, reporter, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, input.targetKind, target, reason, wallet, now());
  return { id };
}

export async function listAbuse(wallet: string) {
  if (!isAdmin(wallet)) fail(403, "This area is for platform administrators.");
  return {
    queue: await (await db()).all("SELECT id, target_kind AS targetKind, target, reason, reporter, status, created_at AS at FROM abuse ORDER BY created_at"),
    audit: await (await db()).all("SELECT at, actor, action, target, reason FROM audit ORDER BY id DESC LIMIT 200"),
    // Counts only. Administrators never see report contents.
    counts: await (await db()).get(
        `SELECT COUNT(*) AS reports,
                SUM(status IN ('submitted','triage','needs_information')) AS open,
                SUM(status IN ('reward_agreed','paid')) AS accepted,
                COUNT(DISTINCT reporter) AS researchers
         FROM reports WHERE chain_id = ?`, CHAIN),
  };
}

export async function decideAbuse(wallet: string, id: string, action: string, reason: string) {
  if (!isAdmin(wallet)) fail(403, "This area is for platform administrators.");
  const a = await (await db()).get("SELECT * FROM abuse WHERE id = ?", id) as { id: string; target_kind: string; target: string; status: string } | undefined;
  if (!a) fail(404, "Abuse report not found.");
  if (a!.status !== "open") fail(409, "Already decided.");
  if (action !== "hide" && action !== "dismiss") fail(400, "Hide or dismiss.");
  const why = text(reason, "Reason", 10, 2000);
  await tx(async (q) => {
    await q.run("UPDATE abuse SET status = ? WHERE id = ?", action === "hide" ? "hidden" : "dismissed", id);
    if (action === "hide" && a!.target_kind === "programme" && /^\d+$/.test(a!.target)) {
      await q.run("INSERT OR REPLACE INTO hidden_programmes(chain_id, programme_id, reason, at) VALUES (?, ?, ?, ?)", CHAIN, Number(a!.target), why, now());
    }
    if (action === "hide" && a!.target_kind === "report") {
      // Closes the submission without anyone reading it: status only, contents untouched.
      const rep = await q.get("SELECT id, status FROM reports WHERE ref = ? AND chain_id = ?", a!.target, CHAIN) as { id: string; status: string } | undefined;
      if (rep && rep.status !== "paid" && rep.status !== "reward_agreed") {
        await q.run("UPDATE reports SET status = 'invalid', reason = 'Closed by platform moderation as spam.', updated_at = ? WHERE id = ?", now(), rep.id);
        await q.run("INSERT INTO report_history(report_id, status, actor, reason, at) VALUES (?, 'invalid', ?, 'Closed by platform moderation as spam.', ?)", rep.id, wallet, now());
      }
    }
    await audit(
      wallet,
      action === "dismiss" ? `Dismissed abuse report ${id}` : a!.target_kind === "programme" ? "Hid programme from directory" : "Rejected report as spam",
      a!.target,
      why,
      q,
    );
  });
  return listAbuse(wallet);
}
