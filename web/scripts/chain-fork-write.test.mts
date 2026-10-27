// Exercises every write path of lib/tx.ts against a local anvil fork of BOT Chain mainnet, impersonating
// the owner of programme PROGRAMME (a paused test programme). Nothing is sent to the real network.
// Run through scripts/test-chain.sh, which starts the fork and sets the environment.
import assert from "node:assert/strict";
import { createTestClient, createWalletClient, http, keccak256, encodeAbiParameters, type Hex } from "viem";

const RPC = process.env.NEXT_PUBLIC_SEHAT_RPC!;
const OWNER = process.env.OWNER as Hex;
const P = Number(process.env.PROGRAMME);
const id = String(P);
const RECIPIENT = "0x581B2a375dF66Af38756B3dc6CAD1D1491d069Bb" as Hex;

const { VIEM_CHAIN } = await import("../lib/config");
const tx = await import("../lib/tx");
const { findProgramme } = await import("../lib/programmes");
const { balance } = await import("../lib/sample-data");

const test = createTestClient({ chain: VIEM_CHAIN, mode: "anvil", transport: http(RPC) });
await test.impersonateAccount({ address: OWNER });
await test.setBalance({ address: OWNER, value: BigInt(10) ** BigInt(19) });
const owner: import("../lib/tx").Sender = { wallet: createWalletClient({ chain: VIEM_CHAIN, transport: http(RPC) }), account: OWNER };
const stranger: import("../lib/tx").Sender = { wallet: owner.wallet, account: RECIPIENT };

const refuses = async (p: Promise<unknown>, expect: RegExp, label: string) => {
  try {
    await p;
    assert.fail(`${label}: expected a refusal`);
  } catch (e) {
    const msg = tx.explainError(e);
    assert.match(msg, expect, `${label}: got "${msg}"`);
    console.log(`  refused as expected (${label}): ${msg}`);
  }
};
const bal = async (id: string) => balance((await findProgramme(id))!);

const before = await bal(id);
console.log(`programme ${P} balance on fork:`, before);

let hashSeen = "";
await tx.setProgrammePaused(owner, P, false, (h) => (hashSeen = h));
assert.ok(hashSeen.startsWith("0x"), "onHash called before the receipt");
assert.equal((await findProgramme(id))!.status, "active");
console.log(`  resumed programme ${P}`);

await tx.fundProgramme(owner, P, "0.05");
assert.equal(Math.round((await bal(id)) * 1e6), Math.round((before + 0.05) * 1e6));
console.log("  funded +0.05 →", await bal(id));

const ref = keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes32" }], ["FORK-0001", keccak256("0x01")]));
await tx.releaseReward(owner, P, ref, RECIPIENT, "0.01");
console.log("  released 0.01 →", await bal(id));
await refuses(tx.releaseReward(owner, P, ref, RECIPIENT, "0.01"), /already been paid/, "same report twice");
await refuses(tx.releaseReward(owner, P, keccak256("0x02"), RECIPIENT, "50"), /does not hold enough/, "more than escrow");
await refuses(tx.releaseReward(stranger, P, keccak256("0x03"), RECIPIENT, "0.001"), /Only the programme owner/, "non-owner");

const countBefore = await (await import("../lib/chain")).readProgrammeCount();
const { programmeId } = await tx.registerProgramme(owner, keccak256("0xabcd"), "/metadata/none.json", 7);
assert.equal(programmeId, countBefore + 1);
const p2 = (await findProgramme(String(programmeId)))!;
assert.equal(p2.onChain?.metadataStatus, "unavailable", "missing metadata is reported, not invented");
console.log("  registered programme", programmeId, "· metadata", p2.onChain?.metadataStatus);
await refuses(tx.registerProgramme(owner, keccak256("0xabcd"), "", 3), /between 7 and 365 days/, "closing window too short");

await tx.startClosing(owner, P);
assert.equal((await findProgramme(id))!.status, "closing");
await refuses(tx.fundProgramme(owner, P, "0.01"), /status does not allow/, "fund while closing");
await refuses(tx.withdrawUnused(owner, P, OWNER), /not ended yet/, "withdraw before the window ends");

await test.increaseTime({ seconds: 7 * 86_400 + 1 });
await test.mine({ blocks: 1 });
await tx.withdrawUnused(owner, P, OWNER);
const closed = (await findProgramme(id))!;
assert.equal(closed.status, "closed");
assert.equal(balance(closed), 0);
assert.ok(closed.events.some((e) => e.kind === "withdrawn"), "withdrawal appears in the history");
console.log("  closed and withdrew; history:", closed.events.map((e) => e.kind).join(" → "));
console.log("OK: every write path behaves as the contract and UI expect");
