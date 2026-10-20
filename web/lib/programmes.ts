// Server-side source of programmes. In chain-live mode they are built from the escrow contract and
// their public metadata (verified against the hash recorded on-chain); otherwise from sample data.
// Server only: it reads metadata served from /public through the file system.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { keccak256, type Hex } from "viem";
import { CHAIN_LIVE } from "./config";
import { type ChainEvent, type RawProgramme, isoDate, readAllProgrammes, readEvents, readProgramme, toBot } from "./chain";
import { PROGRAMMES, SEVERITIES, type Programme, type ProgrammeStatus, type Severity, getProgramme } from "./sample-data";

type Metadata = {
  test?: boolean;
  project?: string;
  title?: string;
  summary?: string;
  scope?: { target: string; kind: string; note: string }[];
  outOfScope?: { target: string; note: string }[];
  tiers?: { severity: string; min: string | number; max: string | number; example?: string }[];
  rules?: string[];
  automatedScanning?: string;
  disclosure?: string;
  duplicates?: string;
  triagers?: { name: string; wallet: string }[];
};

async function loadMetadataBytes(uri: string): Promise<Uint8Array | null> {
  try {
    if (uri.startsWith("/")) {
      // Served by this app from /public. Resolve inside public/ only.
      const root = path.join(process.cwd(), "public");
      const file = path.normalize(path.join(root, uri));
      if (!file.startsWith(root)) return null;
      return new Uint8Array(await readFile(file));
    }
    const url = uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;
    if (!/^https:\/\//.test(url)) return null;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadMetadata(uri: string, hash: Hex): Promise<{ meta: Metadata; status: "verified" | "mismatch" | "unavailable" }> {
  const bytes = uri ? await loadMetadataBytes(uri) : null;
  if (!bytes) return { meta: {}, status: "unavailable" };
  if (keccak256(bytes).toLowerCase() !== hash.toLowerCase()) return { meta: {}, status: "mismatch" };
  try {
    return { meta: JSON.parse(new TextDecoder().decode(bytes)) as Metadata, status: "verified" };
  } catch {
    return { meta: {}, status: "mismatch" };
  }
}

const STATUS: Record<RawProgramme["status"], ProgrammeStatus> = {
  none: "draft",
  active: "active",
  paused: "paused",
  closing: "closing",
  closed: "closed",
};

async function toProgramme(raw: RawProgramme, events: ChainEvent[], latestBlock: number, latestTime: number): Promise<Programme> {
  const own = events.filter((e) => e.programmeId === raw.id);
  const reg = own.find((e) => e.kind === "registered");
  // The latest pointer wins: registration, then any MetadataUpdated after it.
  const current = [...own].reverse().find((e) => e.kind === "registered" || e.kind === "metadata");
  const { meta, status } = await loadMetadata(current?.metadataURI ?? "", raw.metadataHash);
  const ok = status === "verified";
  const tiers = SEVERITIES.map((severity: Severity) => {
    const t = ok ? meta.tiers?.find((x) => x.severity === severity) : undefined;
    return { severity, min: Number(t?.min ?? 0), max: Number(t?.max ?? 0), example: t?.example ?? "" };
  });

  const sumOf = (k: ChainEvent["kind"]) => own.filter((e) => e.kind === k).reduce((t, e) => t + e.amount, 0);
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const historyComplete = same(sumOf("funded"), toBot(raw.totalFunded)) && same(sumOf("paid"), toBot(raw.totalPaid));

  return {
    id: String(raw.id),
    project: ok && meta.project ? meta.project : `Programme ${raw.id}`,
    title: ok && meta.title ? meta.title : status === "mismatch" ? "Metadata does not match its on-chain hash" : "Metadata unavailable",
    status: STATUS[raw.status],
    owner: raw.owner,
    startDate: reg ? isoDate(reg.timestamp) : "",
    closingWindowDays: Math.round(raw.closingWindow / 86_400),
    summary: (ok && meta.summary) || "",
    scope: (ok && meta.scope) || [],
    outOfScope: (ok && meta.outOfScope) || [],
    tiers,
    rules: (ok && meta.rules) || [],
    automatedScanning: (ok && meta.automatedScanning) || "Not stated.",
    disclosure: (ok && meta.disclosure) || "Not stated.",
    duplicates: (ok && meta.duplicates) || "Not stated.",
    triagers: (ok && meta.triagers) || [],
    test: ok && meta.test === true,
    events: own
      .filter((e) => e.kind === "funded" || e.kind === "paid" || e.kind === "withdrawn")
      .map((e) => ({
        kind: e.kind as "funded" | "paid" | "withdrawn",
        amount: e.amount,
        date: isoDate(e.timestamp),
        block: e.block,
        tx: e.tx,
        reportRef: e.reportRef,
      })),
    onChain: {
      programmeId: raw.id,
      balance: toBot(raw.balance),
      totalFunded: toBot(raw.totalFunded),
      totalPaid: toBot(raw.totalPaid),
      closesAt: raw.closesAt || null,
      closingWindowSeconds: raw.closingWindow,
      readAtBlock: latestBlock,
      readAtTime: latestTime,
      metadataHash: raw.metadataHash,
      metadataURI: current?.metadataURI ?? "",
      metadataStatus: status,
      historyComplete,
    },
  };
}

export async function listProgrammes(): Promise<Programme[]> {
  if (!CHAIN_LIVE) return PROGRAMMES;
  const [raws, { events, latestBlock, latestTime }] = await Promise.all([readAllProgrammes(), readEvents()]);
  return Promise.all(raws.map((r) => toProgramme(r, events, latestBlock, latestTime)));
}

export async function findProgramme(id: string): Promise<Programme | undefined> {
  if (!CHAIN_LIVE) return getProgramme(id);
  if (!/^\d+$/.test(id)) return undefined;
  const raw = await readProgramme(Number(id));
  if (!raw) return undefined;
  const { events, latestBlock, latestTime } = await readEvents(raw.id);
  return toProgramme(raw, events, latestBlock, latestTime);
}
