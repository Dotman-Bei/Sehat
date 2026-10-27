// Reads programme 1 (a test programme) from the live BOT Chain mainnet deployment through the app's own data layer.
// Run: npx tsx scripts/chain-live-read.test.mts   (env set by scripts/test-chain.sh)
import assert from "node:assert/strict";

const { findProgramme, listProgrammes } = await import("../lib/programmes");
const { balance, funded, paidOut } = await import("../lib/sample-data");

const p = await findProgramme("1");
assert.ok(p, "programme 1 exists");
console.log("programme 1:", p.project, "·", p.title, "· status", p.status, "· test", p.test);
console.log("  metadata", p.onChain?.metadataStatus, "· read at block", p.onChain?.readAtBlock);
console.log("  funded", funded(p), "paid", paidOut(p), "balance", balance(p));
console.log("  events", p.events.map((e) => `${e.kind} ${e.amount} @${e.block}`).join(", "));

assert.equal(p.onChain?.metadataStatus, "verified", "metadata matches the on-chain hash");
assert.equal(p.test, true);
assert.ok(funded(p) >= 0.001);
assert.ok(paidOut(p) >= 0.0009);
assert.equal(Math.round((funded(p) - paidOut(p) - balance(p)) * 1e6), 0, "funded - paid = balance");
const ev = p.events.map((e) => e.kind);
assert.ok(ev.includes("funded") && ev.includes("paid"), "funding and payout events read");
const sumEvents = p.events.reduce((t, e) => t + (e.kind === "funded" ? e.amount : -e.amount), 0);
assert.equal(Math.round((sumEvents - balance(p)) * 1e6), 0, "event history agrees with contract balance");

assert.equal(await findProgramme("999"), undefined, "unknown id is undefined");
assert.equal(await findProgramme("quayside-bridge"), undefined, "sample slugs do not resolve in live mode");
const all = await listProgrammes();
assert.ok(all.length >= 1);
console.log("OK: live read through the app data layer,", all.length, "programme(s)");
