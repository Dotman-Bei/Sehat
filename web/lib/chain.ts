// Read access to the SehatEscrow contract. Safe to import on the server and in the browser.

import { createPublicClient, formatEther, http, type Hex } from "viem";
import { ESCROW_ABI } from "./escrow-abi";
import { ACTIVE_NETWORK, ESCROW_ADDRESS, ESCROW_DEPLOY_BLOCK, VIEM_CHAIN } from "./config";

export const publicClient = createPublicClient({ chain: VIEM_CHAIN, transport: http(ACTIVE_NETWORK.rpc) });

const escrow = () => {
  if (!ESCROW_ADDRESS) throw new Error("NEXT_PUBLIC_SEHAT_ESCROW is not set");
  return ESCROW_ADDRESS as Hex;
};

/** On-chain status enum, in contract order. */
export const CHAIN_STATUS = ["none", "active", "paused", "closing", "closed"] as const;
export type ChainStatus = (typeof CHAIN_STATUS)[number];

export type RawProgramme = {
  id: number;
  owner: Hex;
  status: ChainStatus;
  closingWindow: number;
  closesAt: number;
  pendingOwner: Hex;
  balance: bigint;
  totalFunded: bigint;
  totalPaid: bigint;
  metadataHash: Hex;
};

export const toBot = (wei: bigint) => Number(formatEther(wei));

export async function readProgrammeCount(): Promise<number> {
  return Number(await publicClient.readContract({ address: escrow(), abi: ESCROW_ABI, functionName: "programmeCount" }));
}

export async function readProgramme(id: number): Promise<RawProgramme | null> {
  const p = await publicClient.readContract({ address: escrow(), abi: ESCROW_ABI, functionName: "getProgramme", args: [BigInt(id)] });
  if (p.status === 0) return null;
  return {
    id,
    owner: p.owner,
    status: CHAIN_STATUS[p.status],
    closingWindow: Number(p.closingWindow),
    closesAt: Number(p.closesAt),
    pendingOwner: p.pendingOwner,
    balance: p.balance,
    totalFunded: p.totalFunded,
    totalPaid: p.totalPaid,
    metadataHash: p.metadataHash,
  };
}

export async function readAllProgrammes(): Promise<RawProgramme[]> {
  const count = await readProgrammeCount();
  const all = await Promise.all(Array.from({ length: count }, (_, i) => readProgramme(i + 1)));
  return all.filter((p): p is RawProgramme => p !== null);
}

export type ChainEvent = {
  kind: "registered" | "metadata" | "funded" | "paid" | "withdrawn";
  programmeId: number;
  amount: number; // BOT
  block: number;
  timestamp: number; // unix seconds
  tx: Hex;
  reportRef?: Hex;
  recipient?: Hex;
  metadataURI?: string;
  metadataHash?: Hex;
};

const CHUNK = BigInt(50_000);

/** Every escrow event (optionally for one programme), oldest first, with block timestamps. */
export async function readEvents(programmeId?: number): Promise<{ events: ChainEvent[]; latestBlock: number }> {
  const latest = await publicClient.getBlockNumber();
  const id = programmeId === undefined ? undefined : BigInt(programmeId);
  const raw: ChainEvent[] = [];

  for (let from = ESCROW_DEPLOY_BLOCK; from <= latest; from += CHUNK) {
    const to = from + CHUNK - BigInt(1) > latest ? latest : from + CHUNK - BigInt(1);
    const range = { address: escrow(), abi: ESCROW_ABI, fromBlock: from, toBlock: to } as const;
    const args = id === undefined ? undefined : { programmeId: id };
    const [reg, meta, fund, paid, out] = await Promise.all([
      publicClient.getContractEvents({ ...range, eventName: "ProgrammeRegistered", args }),
      publicClient.getContractEvents({ ...range, eventName: "MetadataUpdated", args }),
      publicClient.getContractEvents({ ...range, eventName: "Funded", args }),
      publicClient.getContractEvents({ ...range, eventName: "RewardReleased", args }),
      publicClient.getContractEvents({ ...range, eventName: "UnusedWithdrawn", args }),
    ]);
    const base = (l: { blockNumber: bigint; transactionHash: Hex }) => ({ block: Number(l.blockNumber), timestamp: 0, tx: l.transactionHash });
    for (const l of reg)
      raw.push({ ...base(l), kind: "registered", programmeId: Number(l.args.programmeId), amount: 0, metadataURI: l.args.metadataURI, metadataHash: l.args.metadataHash });
    for (const l of meta)
      raw.push({ ...base(l), kind: "metadata", programmeId: Number(l.args.programmeId), amount: 0, metadataURI: l.args.metadataURI, metadataHash: l.args.metadataHash });
    for (const l of fund) raw.push({ ...base(l), kind: "funded", programmeId: Number(l.args.programmeId), amount: toBot(l.args.amount!) });
    for (const l of paid)
      raw.push({ ...base(l), kind: "paid", programmeId: Number(l.args.programmeId), amount: toBot(l.args.amount!), reportRef: l.args.reportRef, recipient: l.args.recipient });
    for (const l of out) raw.push({ ...base(l), kind: "withdrawn", programmeId: Number(l.args.programmeId), amount: toBot(l.args.amount!) });
  }

  // Timestamps, one block read per distinct block.
  const blocks = [...new Set(raw.map((e) => e.block))];
  const stamps = new Map<number, number>();
  await Promise.all(
    blocks.map(async (b) => stamps.set(b, Number((await publicClient.getBlock({ blockNumber: BigInt(b) })).timestamp))),
  );
  for (const e of raw) e.timestamp = stamps.get(e.block) ?? 0;
  raw.sort((a, b) => a.block - b.block);
  return { events: raw, latestBlock: Number(latest) };
}

export const isoDate = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);
