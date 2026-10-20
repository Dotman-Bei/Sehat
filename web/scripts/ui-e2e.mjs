// Browser end-to-end test of the full live flow, driven through the real UI.
// Run through scripts/test-ui.sh (anvil fork of Bohr + dev server with a throwaway database).
// The injected wallet forwards to anvil, whose dev accounts can sign messages and send transactions.
import { createHash } from "node:crypto";
import { Browser, sleep } from "../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs";

const APP = process.env.APP;
const RPC = process.env.NEXT_PUBLIC_SEHAT_RPC;
const ESCROW = process.env.NEXT_PUBLIC_SEHAT_ESCROW;
const OUT = process.env.OUT;
const [OWNER, RESEARCHER, ADMIN] = JSON.parse(process.env.ACCOUNTS);

const rpc = async (method, params = []) => {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
};

// ---- a real programme on the fork, registered and funded by OWNER with cast-equivalent calls ----
const { encodeFunctionData, keccak256, toHex, decodeEventLog } = await import("viem");
const { ESCROW_ABI } = await import("../lib/escrow-abi.ts");
const meta = JSON.stringify({
  schema: "sehat.programme/1",
  project: "Harbour",
  title: "Harbour vault and router",
  summary: "Deposit vault and swap router for the Harbour pools.",
  scope: [{ target: "HarbourVault.sol", kind: "Smart contract", note: "Deposits and withdrawals" }],
  outOfScope: [],
  tiers: [
    { severity: "Critical", min: "0.5", max: "1" },
    { severity: "High", min: "0.1", max: "0.5" },
    { severity: "Medium", min: "0.05", max: "0.1" },
    { severity: "Low", min: "0.01", max: "0.05" },
    { severity: "Informational", min: "0", max: "0.01" },
  ],
  rules: ["Test on a fork only.", "No denial of service."],
});
const send = async (data, value = "0x0") => {
  const hash = await rpc("eth_sendTransaction", [{ from: OWNER, to: ESCROW, data, value }]);
  for (let i = 0; i < 50; i++) {
    const r = await rpc("eth_getTransactionReceipt", [hash]);
    if (r) return r;
    await sleep(200);
  }
  throw new Error("no receipt");
};
const reg = await send(
  encodeFunctionData({ abi: ESCROW_ABI, functionName: "register", args: [keccak256(toHex(meta)), `data:application/json;base64,${Buffer.from(meta).toString("base64")}`, 7 * 86400] }),
);
const ev = reg.logs.map((l) => { try { return decodeEventLog({ abi: ESCROW_ABI, data: l.data, topics: l.topics }); } catch { return null; } }).find((e) => e?.eventName === "ProgrammeRegistered");
const PID = Number(ev.args.programmeId);
await send(encodeFunctionData({ abi: ESCROW_ABI, functionName: "fund", args: [BigInt(PID)] }), "0xde0b6b3a7640000"); // 1 BOT
console.log(`programme ${PID} registered and funded by ${OWNER.slice(0, 8)}…`);

// ---- browser helpers --------------------------------------------------------------------------------
const b = await Browser.launch();
const p = await b.newPage({ width: 1440, height: 1000 });
let as = null;
const inject = () =>
  p.eval(({ RPC, as }) => {
    window.ethereum = {
      async request({ method, params }) {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [as];
        const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params ?? [] }) });
        const j = await r.json();
        if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code, data: j.error.data });
        return j.result;
      },
      on() {},
      removeListener() {},
    };
  }, { RPC, as });
async function open(path, who) {
  as = who;
  await p.goto(APP + path, { settleMs: 2500 });
  await inject();
}
const text = () => p.eval(() => document.body.innerText);
async function waitFor(re, label, ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (re.test(await text())) return console.log("  ✓", label);
    await sleep(400);
  }
  await p.screenshot({ path: `${OUT}/fail-${label.replace(/\W+/g, "-").slice(0, 60)}.jpg` });
  throw new Error(`timed out waiting for: ${label}`);
}
const click = (re, scope = "") =>
  p.eval(({ src, scope }) => {
    const r = new RegExp(src);
    const el = [...document.querySelectorAll(`${scope} button, ${scope} a`)].find((x) => r.test(x.textContent.trim()) && !x.disabled);
    if (!el) return false;
    el.click();
    return true;
  }, { src: re.source, scope });
const mustClick = async (re, label, scope = "main") => {
  for (let i = 0; i < 30; i++) {
    if (await click(re, scope)) return;
    await sleep(300);
  }
  await p.screenshot({ path: `${OUT}/fail-click-${label.replace(/\W+/g, "-")}.jpg` });
  throw new Error(`no clickable: ${label}`);
};
const fill = (sel, v) =>
  p.eval(({ sel, v }) => {
    const el = document.querySelector(sel);
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  }, { sel, v });
const signOut = () => p.eval(() => fetch("/api/auth/logout", { method: "POST" }));
async function connectAndSignIn() {
  await mustClick(/^Connect wallet$/, "connect");
  await mustClick(/^Sign in with this wallet$/, "sign in");
}

// ---- 1. researcher submits ------------------------------------------------------------------------
console.log("researcher");
await open(`/programs/${PID}/submit`, RESEARCHER);
await connectAndSignIn();
await waitFor(/Suggested severity/, "signed in; the form appears");
await fill("#f-title", "Withdraw rounds in the attacker's favour");
await fill("#f-category", "Arithmetic / rounding");
await fill("#f-target", "HarbourVault.sol");
await p.eval(() => document.querySelector("input[value=High]").click());
await fill("#f-impact", "Repeated small withdrawals drain dust from other depositors over many blocks.");
await fill("#f-steps", "Deposit one wei.\nWithdraw in a loop of 500 calls.\nCompare the vault balance before and after.");
await p.eval(() => document.querySelector("#f-confirm").click());
await sleep(300);
await mustClick(/^Submit privately$/, "submit");
await waitFor(/Report SHT-\d{4} received/, "report stored; real reference shown");
await p.screenshot({ path: `${OUT}/e2e-1-submitted.jpg` });
await mustClick(/^Open the private report$/, "open report");
await waitFor(/Withdraw rounds in the attacker's favour[\s\S]*Reproduction steps/, "researcher reads the private report");
const reportPath = new URL(await p.eval(() => location.href)).pathname;
console.log("  report link", reportPath);

// ---- 2. owner triages -----------------------------------------------------------------------------
console.log("owner");
await signOut();
await open(`/dashboard/programs/${PID}`, OWNER);
await mustClick(/^Connect wallet$/, "owner connect");
await waitFor(/Sign in with the Harbour owner wallet/, "queue asks the owner to sign in");
await mustClick(/^Sign in with this wallet$/, "owner sign in");
await waitFor(/SHT-\d{4}/, "queue lists the report from the API");
await p.screenshot({ path: `${OUT}/e2e-2-queue.jpg` });
await mustClick(/^Triage$/, "triage button");
await waitFor(/Reproduction steps/, "owner opens the report");
await inject();
await fill("#t-decision", "needs_information");
await sleep(200);
await fill("#t-why", "Which block did you fork from, and what was the vault balance?");
await mustClick(/^Mark as needs information$/, "needs info");
await waitFor(/Which block did you fork from/, "question saved and shown");

// researcher answers
console.log("researcher replies");
await signOut();
await open(reportPath, RESEARCHER);
await waitFor(/Sign in with the wallet that submitted this report/, "private page asks for sign-in");
await connectAndSignIn();
await waitFor(/Which block did you fork from/, "researcher sees the team's question");
await fill("#reply", "Forked at block 27,530,000; vault held 12.4 BOT.");
await mustClick(/^Send$/, "send reply");
await waitFor(/vault held 12\.4 BOT/, "reply posted");

// owner accepts with a reward and releases
console.log("owner accepts and releases");
await signOut();
await open(reportPath, OWNER);
await connectAndSignIn();
await waitFor(/vault held 12\.4 BOT/, "owner sees the reply");
await inject();
await fill("#t-decision", "accepted");
await sleep(200);
await fill("#t-sev", "High");
await sleep(200);
await fill("#t-amount", "0.2");
await mustClick(/^Accept and propose reward$/, "accept");
await waitFor(/0\.2\s*BOT agreed/, "reward agreed");
await inject();
await mustClick(/^Connect wallet$/, "connect for release", "body").catch(() => {});
await sleep(800);
await mustClick(/^Release 0\.2 BOT$/, "release");
await sleep(500);
await p.screenshot({ path: `${OUT}/e2e-3-release-dialog.jpg` });
await mustClick(/^Release 0\.2 BOT$/, "confirm release", "dialog");
await waitFor(/0\.2\s*BOT paid/, "paid after the receipt and the server's check");
await p.screenshot({ path: `${OUT}/e2e-4-paid.jpg` });

// ---- 3. researcher sees the payout ----------------------------------------------------------------
console.log("researcher dashboard");
await signOut();
await open("/researcher", RESEARCHER);
await connectAndSignIn();
await waitFor(/Withdraw rounds in the attacker's favour[\s\S]*Paid/, "dashboard shows the report as paid");
await p.screenshot({ path: `${OUT}/e2e-5-researcher.jpg` });
console.log("researcher reports the programme to moderators");
await open(`/programs/${PID}`, RESEARCHER);
await mustClick(/^Report a problem with Harbour$/, "report problem");
await fill("#abuse-reason", "Scope lists a contract that belongs to another project.");
await mustClick(/^Send to moderators$/, "send abuse");
await waitFor(/Platform moderators will review it/, "abuse report sent from the programme page");

// ---- 4. admin moderates ----------------------------------------------------------------------------
console.log("admin");
await signOut();
await open("/admin", ADMIN);
await connectAndSignIn();
await waitFor(/Scope lists a contract that belongs to another project/, "admin sees the abuse report");
await waitFor(/Reports\s*1/, "admin sees counts, not contents");
const leaked = /Withdraw rounds in the attacker/.test(await text());
if (leaked) throw new Error("admin page shows report content");
console.log("  ✓ no report content on the admin page");
await mustClick(/^Review$/, "review");
await p.eval(() => [...document.querySelectorAll("input[type=radio]")].find((r) => r.parentElement.textContent.includes("Hide from directory")).click());
await fill("textarea", "Confirmed: the scope belongs to another project.");
await mustClick(/^Record decision$/, "decide");
await waitFor(/Hid programme from directory/, "decision in the audit log");
await p.screenshot({ path: `${OUT}/e2e-6-admin.jpg` });
const dir = await (await fetch(`${APP}/programs`)).text();
if (dir.includes("Harbour vault and router")) throw new Error("hidden programme still listed");
console.log("  ✓ hidden programme left the directory");

await b.close();
console.log("UI E2E PASSED");
