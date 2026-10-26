// Team TEST of the mainnet escrow with 7 throwaway wallets: 10 transactions covering register+fund,
// fund, releaseReward, setPaused and the ownership handover. Not user activity; never report it as usage.
//   MODE=fork RPC=http://127.0.0.1:8553 npx tsx scripts/mainnet-test-plan.mts   (measures gas, sends nothing real)
//   MODE=mainnet npx tsx scripts/mainnet-test-plan.mts                          (sends the 10 transactions)
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  http,
  keccak256,
  parseEther,
  parseGwei,
  toHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ESCROW_ABI } from "../lib/escrow-abi";

const MODE = process.env.MODE ?? "fork";
const RPC = MODE === "mainnet" ? "https://rpc.botchain.ai" : process.env.RPC!;
const ESCROW = "0xD438c5aF89538Dc8a00ABCFB688c42ebBAA0463D" as Hex;
const GAS_PRICE = parseGwei("20"); // BOT Chain floor; lower is rejected
const chain = defineChain({ id: 677, name: "BOT Chain", nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });

const env = Object.fromEntries(
  readFileSync("../contracts/.env.testwallets", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => l.split("=") as [string, string]),
);
const W = Array.from({ length: 7 }, (_, i) => privateKeyToAccount(env[`W${i + 1}_KEY`] as Hex));
const pub = createPublicClient({ chain, transport: http(RPC) });

if (MODE === "fork") {
  // Fork: only W1 is funded, exactly as on mainnet; everyone else starts empty.
  await pub.request({ method: "anvil_setBalance" as never, params: [W[0].address, toHex(parseEther("0.021"))] as never });
  for (const a of W.slice(1)) await pub.request({ method: "anvil_setBalance" as never, params: [a.address, "0x0"] as never });
}

// Step 0: W1 forwards to W2 and W6 what they need (gas limits x 20 gwei + the BOT they escrow), measured on a fork.
const TOP_UP: Record<number, bigint> = { 2: parseEther("0.0063"), 6: parseEther("0.0029") };
for (const [to, amount] of Object.entries(TOP_UP)) {
  const have = await pub.getBalance({ address: W[Number(to) - 1].address });
  if (have >= amount) continue;
  const wallet = createWalletClient({ account: W[0], chain, transport: http(RPC) });
  const hash = await wallet.sendTransaction({ to: W[Number(to) - 1].address, value: amount - have, gas: BigInt(21000), gasPrice: GAS_PRICE, type: "legacy", chain });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`0. W1 → W${to} ${formatEther(amount - have)} BOT for gas  ${hash}`);
}

const meta = (label: string) =>
  JSON.stringify({
    schema: "sehat.programme/1",
    test: true,
    project: "Sehat test",
    title: `Mainnet contract test ${label} (not a real bounty)`,
    summary: "Team test of the escrow contract. Takes no reports and pays nothing for findings.",
    scope: [{ target: "SehatEscrow", kind: "Smart contract", note: "Test only" }],
    tiers: [{ severity: "Low", min: "0.0001", max: "0.0005" }],
    rules: ["Test programme. Do not submit reports."],
  });
const metaArgs = (label: string) => {
  const m = meta(label);
  return [keccak256(toHex(m)), `data:application/json;base64,${Buffer.from(m).toString("base64")}`, 7 * 86400] as const;
};
const ref = (n: number) => keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes32" }], [`MAINNET-TEST-${n}`, keccak256(toHex(`sehat-mainnet-test-${n}-2026-10-25`))]));

type Row = { step: number; from: number; what: string; gasEstimate: number; gasLimit: number; gasUsed: number; valueBot: string; tx: string };
const rows: Row[] = [];
let A = 0, B = 0;

async function send(step: number, from: number, what: string, fn: string, args: readonly unknown[], value = BigInt(0)) {
  const account = W[from - 1];
  const data = encodeFunctionData({ abi: ESCROW_ABI, functionName: fn as never, args: args as never });
  const est = await pub.estimateGas({ account, to: ESCROW, data, value });
  const gas = (est * BigInt(110)) / BigInt(100);
  const wallet = createWalletClient({ account, chain, transport: http(RPC) });
  const hash = await wallet.sendTransaction({ to: ESCROW, data, value, gas, gasPrice: GAS_PRICE, type: "legacy", chain });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`step ${step} reverted: ${hash}`);
  rows.push({ step, from, what, gasEstimate: Number(est), gasLimit: Number(gas), gasUsed: Number(r.gasUsed), valueBot: formatEther(value), tx: hash });
  console.log(`${step}. W${from} ${what.padEnd(44)} gas ${r.gasUsed} (limit ${gas})  ${hash}`);
  return r;
}
const programmeIdOf = (r: Awaited<ReturnType<typeof send>>) => {
  for (const l of r.logs) {
    try {
      const e = decodeEventLog({ abi: ESCROW_ABI, data: l.data, topics: l.topics });
      if (e.eventName === "ProgrammeRegistered") return Number(e.args.programmeId);
    } catch {}
  }
  throw new Error("no programme id");
};
const addr = (i: number) => W[i - 1].address;

console.log(`mode ${MODE}, escrow ${ESCROW}, gas price 20 gwei`);
A = programmeIdOf(await send(1, 1, "register test programme A + fund 0.0008", "register", metaArgs("A"), parseEther("0.0008")));
B = programmeIdOf(await send(2, 2, "register test programme B + fund 0.0004", "register", metaArgs("B"), parseEther("0.0004")));
await send(3, 1, `fund A (#${A}) +0.0002`, "fund", [BigInt(A)], parseEther("0.0002"));
await send(4, 1, `release 0.0003 from A to W3`, "releaseReward", [BigInt(A), ref(1), addr(3), parseEther("0.0003")]);
await send(5, 1, `release 0.0003 from A to W4`, "releaseReward", [BigInt(A), ref(2), addr(4), parseEther("0.0003")]);
await send(6, 2, `release 0.0003 from B (#${B}) to W5`, "releaseReward", [BigInt(B), ref(3), addr(5), parseEther("0.0003")]);
await send(7, 2, `pause B`, "setPaused", [BigInt(B), true]);
await send(8, 1, `offer A to W6`, "transferProgrammeOwnership", [BigInt(A), addr(6)]);
await send(9, 6, `accept ownership of A`, "acceptProgrammeOwnership", [BigInt(A)]);
await send(10, 6, `release 0.0003 from A to W7 (new owner)`, "releaseReward", [BigInt(A), ref(4), addr(7), parseEther("0.0003")]);

// Free checks (simulated, nothing sent): refusals the contract must keep making.
const refuses = async (label: string, from: number, fn: string, args: readonly unknown[]) => {
  try {
    await pub.simulateContract({ account: W[from - 1], address: ESCROW, abi: ESCROW_ABI, functionName: fn as never, args: args as never });
    console.log(`  ✗ ${label}: NOT refused`);
  } catch (e) {
    console.log(`  ✓ ${label}: refused (${(e as { cause?: { data?: { errorName?: string } } }).cause?.data?.errorName ?? "reverted"})`);
  }
};
await refuses("same report paid twice", 6, "releaseReward", [BigInt(A), ref(1), addr(3), parseEther("0.0001")]);
await refuses("old owner releases after handover", 1, "releaseReward", [BigInt(A), ref(9), addr(3), parseEther("0.0001")]);
await refuses("payout above escrow", 6, "releaseReward", [BigInt(A), ref(8), addr(3), parseEther("1")]);

const pa = await pub.readContract({ address: ESCROW, abi: ESCROW_ABI, functionName: "getProgramme", args: [BigInt(A)] });
const pb = await pub.readContract({ address: ESCROW, abi: ESCROW_ABI, functionName: "getProgramme", args: [BigInt(B)] });
console.log(`programme A #${A}: owner ${pa.owner.slice(0, 10)}… balance ${formatEther(pa.balance)} paid ${formatEther(pa.totalPaid)}`);
console.log(`programme B #${B}: status ${pb.status} (2 = paused) balance ${formatEther(pb.balance)} paid ${formatEther(pb.totalPaid)}`);

// What each wallet needs up front: every gas limit x 20 gwei, plus the BOT it sends.
const need = W.map((_, i) => rows.filter((r) => r.from === i + 1).reduce((t, r) => t + BigInt(r.gasLimit) * GAS_PRICE + parseEther(r.valueBot), BigInt(0)));
const spend = W.map((_, i) => rows.filter((r) => r.from === i + 1).reduce((t, r) => t + BigInt(r.gasUsed) * GAS_PRICE + parseEther(r.valueBot), BigInt(0)));
console.log("\nfunding per wallet (gas limits x 20 gwei + BOT sent):");
W.forEach((a, i) => console.log(`  W${i + 1} ${a.address}  needs ${formatEther(need[i])}  spends ${formatEther(spend[i])}`));
console.log(`  total needs ${formatEther(need.reduce((a, b) => a + b))}, total spends ${formatEther(spend.reduce((a, b) => a + b))}`);
writeFileSync(`../contracts/deployments/mainnet-test-${MODE}.json`, JSON.stringify({ mode: MODE, escrow: ESCROW, programmes: { A, B }, rows }, null, 2));
