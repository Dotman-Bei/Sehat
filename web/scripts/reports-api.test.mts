// End-to-end test of the private reports API against a running server (live mode) and an anvil fork.
// Run through scripts/test-reports.sh, which starts both with a throwaway database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTestClient, createWalletClient, http, keccak256, toHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

const APP = process.env.APP!;
const RPC = process.env.NEXT_PUBLIC_SEHAT_RPC!;
const SERVER_LOG = process.env.SERVER_LOG!;
const host = new URL(APP).host;

const { VIEM_CHAIN } = await import("../lib/config");
const tx = await import("../lib/tx");

const acct = () => privateKeyToAccount(generatePrivateKey());
const owner = acct(), researcher = acct(), triager = acct(), stranger = acct();
const admin = privateKeyToAccount(process.env.ADMIN_KEY as Hex);

const test = createTestClient({ chain: VIEM_CHAIN, mode: "anvil", transport: http(RPC) });
await test.impersonateAccount({ address: owner.address });
await test.setBalance({ address: owner.address, value: BigInt(10) ** BigInt(19) });
const ownerSender = { wallet: createWalletClient({ chain: VIEM_CHAIN, transport: http(RPC) }), account: owner.address as Hex };

// ---- a real programme on the fork, with metadata inline so it verifies -----------------------
const TITLE = "Fork API test programme";
const metadata = JSON.stringify({
  schema: "sehat.programme/1",
  project: "API test",
  title: TITLE,
  summary: "Programme registered by the reports API test.",
  scope: [{ target: "Vault.sol", kind: "Smart contract", note: "Deposits" }],
  outOfScope: [],
  tiers: [
    { severity: "Critical", min: "0.5", max: "1" },
    { severity: "High", min: "0.1", max: "0.5" },
    { severity: "Medium", min: "0.05", max: "0.1" },
    { severity: "Low", min: "0.01", max: "0.05" },
    { severity: "Informational", min: "0", max: "0.01" },
  ],
  rules: ["Test on a fork only."],
});
const uri = `data:application/json;base64,${Buffer.from(metadata).toString("base64")}`;
const { programmeId } = await tx.registerProgramme(ownerSender, keccak256(toHex(metadata)), uri, 7);
await tx.fundProgramme(ownerSender, programmeId, "1");
console.log("programme", programmeId, "registered and funded on the fork");

// ---- http helpers -------------------------------------------------------------------------------
type Jar = { cookie?: string };
async function call(jar: Jar, method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { origin: APP, ...extra };
  if (jar.cookie) headers.cookie = jar.cookie;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(APP + path, { method, headers, body: payload });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) jar.cookie = setCookie.split(";")[0];
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, headers: res.headers, data: type.includes("json") ? await res.json() : await res.text() };
}
async function signIn(account: ReturnType<typeof acct>): Promise<Jar> {
  const jar: Jar = {};
  const { data } = await call(jar, "POST", "/api/auth/nonce");
  const message = createSiweMessage({ address: account.address, chainId: VIEM_CHAIN.id, domain: host, nonce: data.nonce, uri: APP, version: "1", issuedAt: new Date(), statement: "Sign in to Sehat." });
  const signature = await account.signMessage({ message });
  const r = await call(jar, "POST", "/api/auth/verify", { message, signature });
  assert.equal(r.status, 200, `sign-in failed: ${JSON.stringify(r.data)}`);
  return jar;
}
const step = (s: string) => console.log("  ✓", s);

// ---- auth -----------------------------------------------------------------------------------------
assert.equal((await call({}, "GET", "/api/reports?mine=1")).status, 401);
step("no session → 401");
{
  const jar: Jar = {};
  const { data } = await call(jar, "POST", "/api/auth/nonce");
  const message = createSiweMessage({ address: researcher.address, chainId: VIEM_CHAIN.id, domain: host, nonce: data.nonce, uri: APP, version: "1", issuedAt: new Date() });
  const forged = await stranger.signMessage({ message });
  assert.equal((await call(jar, "POST", "/api/auth/verify", { message, signature: forged })).status, 401);
  const sig = await researcher.signMessage({ message });
  assert.equal((await call(jar, "POST", "/api/auth/verify", { message, signature: sig })).status, 200);
  assert.equal((await call({}, "POST", "/api/auth/verify", { message, signature: sig })).status, 400, "nonce reuse refused");
  step("forged signature → 401; valid → 200; replayed nonce → 400");
}
const R = await signIn(researcher), O = await signIn(owner), T = await signIn(triager), S = await signIn(stranger), A = await signIn(admin);
const tampered: Jar = { cookie: R.cookie!.replace(/.$/, (c) => (c === "A" ? "B" : "A")) };
assert.equal((await call(tampered, "GET", "/api/reports?mine=1")).status, 401);
step("tampered session cookie → 401");

// ---- create ---------------------------------------------------------------------------------------
const good = {
  programmeId,
  title: "Withdraw rounds in the attacker's favour",
  category: "Arithmetic / rounding",
  suggested: "High",
  target: "Vault.sol",
  impact: "Repeated small withdrawals drain dust from other depositors over many blocks.",
  steps: "1. Deposit 1 wei. 2. Withdraw in a loop. 3. Compare balances before and after.",
  payoutWallet: researcher.address,
  confirm: true,
};
const bad = await call(R, "POST", "/api/reports", { ...good, target: "SomethingElse.sol" });
assert.equal(bad.status, 400);
assert.match(bad.data.error, /scope/);
assert.equal((await call(R, "POST", "/api/reports", { ...good, confirm: false })).status, 400);
assert.equal((await call(R, "POST", "/api/reports", { ...good, programmeId: 1 })).status, 409, "test programme refuses reports");
step("validation: out-of-scope target, missing confirmation, test programme refused");

assert.equal((await call(R, "POST", "/api/reports", good, { origin: "https://evil.example" })).status, 403);
step("cross-site write → 403");

const created = await call(R, "POST", "/api/reports", good);
assert.equal(created.status, 201, JSON.stringify(created.data));
const { id, ref } = created.data;
assert.match(id, /^r[0-9a-f]{24}$/);
step(`created ${ref} with an unguessable id`);

// ---- access ---------------------------------------------------------------------------------------
assert.equal((await call(S, "GET", `/api/reports/${id}`)).status, 404);
assert.equal((await call(T, "GET", `/api/reports/${id}`)).status, 404);
assert.equal((await call(A, "GET", `/api/reports/${id}`)).status, 404, "admins cannot read reports");
const asOwner = await call(O, "GET", `/api/reports/${id}`);
assert.equal(asOwner.data.role, "owner");
assert.equal(asOwner.data.salt, undefined, "salt never leaves the server");
assert.equal((await call(S, "GET", `/api/reports?programme=${programmeId}`)).status, 403);
step("stranger, triager-to-be and admin get 404; owner reads; salt not exposed; team list closed to strangers");

assert.equal((await call(S, "POST", `/api/programmes/${programmeId}/triagers`, { wallet: triager.address, name: "Tri" })).status, 403);
assert.equal((await call(O, "POST", `/api/programmes/${programmeId}/triagers`, { wallet: triager.address, name: "Tri Ager" })).status, 200);
assert.equal((await call(T, "GET", `/api/reports/${id}`)).data.role, "triager");
step("only the owner adds triagers; the triager can then read");

// ---- thread ---------------------------------------------------------------------------------------
await call(O, "POST", `/api/reports/${id}/messages`, { body: "Reproduced. Internal: patch in progress.", teamOnly: true });
await call(O, "POST", `/api/reports/${id}/messages`, { body: "Thanks, we reproduced it.", teamOnly: false });
assert.equal((await call(R, "POST", `/api/reports/${id}/messages`, { body: "x", teamOnly: true })).status, 403);
const rView = (await call(R, "GET", `/api/reports/${id}`)).data;
const oView = (await call(O, "GET", `/api/reports/${id}`)).data;
assert.equal(rView.messages.length, 1);
assert.equal(oView.messages.length, 2);
step("team-only note hidden from the researcher; researcher cannot post team-only");

// ---- triage ---------------------------------------------------------------------------------------
assert.equal((await call(T, "POST", `/api/reports/${id}/triage`, { status: "needs_information" })).status, 400, "reason required");
assert.equal((await call(T, "POST", `/api/reports/${id}/triage`, { status: "needs_information", reason: "Which block did you fork from?" })).status, 200);
assert.equal((await call(T, "POST", `/api/reports/${id}/triage`, { status: "reward_agreed", confirmed: "High", reward: "0.2" })).status, 403);
assert.equal((await call(O, "POST", `/api/reports/${id}/triage`, { status: "reward_agreed", confirmed: "High", reward: "0.9" })).status, 400, "outside tier");
assert.equal((await call(R, "POST", `/api/reports/${id}/triage`, { status: "invalid", reason: "researcher cannot triage" })).status, 403);
const agreed = await call(O, "POST", `/api/reports/${id}/triage`, { status: "reward_agreed", confirmed: "High", reward: "0.2" });
assert.equal(agreed.data.status, "reward_agreed");
step("reason required; triager cannot agree rewards; tier range enforced; researcher cannot triage; owner agrees 0.2 BOT");

// ---- attachments ----------------------------------------------------------------------------------
const fd = (name: string, bytes: Uint8Array, type: string) => {
  const f = new FormData();
  f.append("file", new Blob([bytes], { type }), name);
  return f;
};
const up = await call(R, "POST", `/api/reports/${id}/attachments`, fd("../../etc/passwd.txt", new TextEncoder().encode("forked at block 27530000\n"), "text/plain"));
assert.equal(up.status, 201, JSON.stringify(up.data));
assert.equal(up.data.name, "passwd.txt", "path stripped from the name");
const exe = await call(R, "POST", `/api/reports/${id}/attachments`, fd("poc.pdf", new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]), "application/pdf"));
assert.equal(exe.status, 415, "type decided by content, not the claimed name or type");
assert.equal((await call(S, "GET", `/api/attachments/${up.data.id}`)).status, 404);
const dl = await call(O, "GET", `/api/attachments/${up.data.id}`);
assert.equal(dl.status, 200);
assert.match(dl.headers.get("content-disposition")!, /^attachment;/);
assert.equal(dl.headers.get("x-content-type-options"), "nosniff");
step("upload sanitised; executable disguised as PDF refused; stranger 404; owner downloads as attachment with nosniff");

// ---- payout --------------------------------------------------------------------------------------
const digest = oView.digest as Hex;
const fundReceipt = await tx.fundProgramme(ownerSender, programmeId, "0.01");
assert.equal((await call(O, "POST", `/api/reports/${id}/paid`, { txHash: fundReceipt.transactionHash })).status, 409, "a non-payout tx is refused");
const wrongAmount = await tx.releaseReward(ownerSender, programmeId, keccak256(toHex("other report")), researcher.address, "0.2");
assert.equal((await call(O, "POST", `/api/reports/${id}/paid`, { txHash: wrongAmount.transactionHash })).status, 409, "payout for a different ref refused");
const release = await tx.releaseReward(ownerSender, programmeId, digest, researcher.address, "0.2");
const paid = await call(R, "POST", `/api/reports/${id}/paid`, { txHash: release.transactionHash });
assert.equal(paid.status, 200, JSON.stringify(paid.data));
assert.equal(paid.data.status, "paid");
assert.equal(paid.data.payoutTx, release.transactionHash.toLowerCase());
step("paid only for the receipt whose RewardReleased matches this report's digest, recipient and amount");

const mine = (await call(R, "GET", "/api/reports?mine=1")).data.reports;
assert.ok(mine.some((r: { id: string; status: string }) => r.id === id && r.status === "paid"));
step("researcher's list shows the report as paid");

// ---- moderation -----------------------------------------------------------------------------------
const ab = await call(R, "POST", "/api/abuse", { targetKind: "programme", target: String(programmeId), reason: "Scope lists a contract that belongs to someone else." });
assert.equal(ab.status, 201);
assert.equal((await call(O, "GET", "/api/abuse")).status, 403);
const queue = (await call(A, "GET", "/api/abuse")).data;
assert.ok(queue.queue.some((q: { id: string }) => q.id === ab.data.id));
assert.equal(queue.counts.reports >= 1, true);
const dirBefore = await (await fetch(`${APP}/programs`)).text();
assert.ok(dirBefore.includes(TITLE), "listed before moderation");
assert.equal((await call(A, "POST", `/api/abuse/${ab.data.id}`, { action: "hide", reason: "Confirmed: scope belongs to another project." })).status, 200);
const dirAfter = await (await fetch(`${APP}/programs`)).text();
assert.ok(!dirAfter.includes(TITLE), "hidden from the directory");
assert.equal((await call(R, "POST", "/api/reports", good)).status, 409, "hidden programme takes no reports");
const auditLog = (await call(A, "GET", "/api/abuse")).data.audit;
assert.ok(auditLog.some((e: { action: string }) => e.action === "Hid programme from directory"));
step("abuse queue admin-only; hiding removes the programme from the directory and blocks reports; audit logged");

// ---- logs -----------------------------------------------------------------------------------------
await new Promise((r) => setTimeout(r, 500));
const log = readFileSync(SERVER_LOG, "utf8");
for (const secret of [good.title, good.impact, "patch in progress", "forked at block"]) assert.ok(!log.includes(secret), `server log leaked: ${secret}`);
step("no report text in the server log");

console.log("OK: reports API end to end");
