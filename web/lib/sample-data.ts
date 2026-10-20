// SAMPLE DATA. Every programme, report, wallet and transaction below is invented for the preview
// build and must be replaced by escrow-contract reads and the private reports API before launch.
// Balances and totals are computed from the event rows, never typed in separately.

export type Severity = "Critical" | "High" | "Medium" | "Low" | "Informational";
export const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low", "Informational"];

export type ProgrammeStatus = "draft" | "active" | "paused" | "closing" | "closed";

export type ReportStatus =
  | "submitted"
  | "triage"
  | "needs_information"
  | "duplicate"
  | "out_of_scope"
  | "invalid"
  | "accepted"
  | "reward_agreed"
  | "paid";

export type EscrowEvent = {
  kind: "funded" | "paid" | "withdrawn";
  amount: number;
  date: string;
  block: number;
  tx: string;
  reportRef?: string;
};

export type Tier = { severity: Severity; min: number; max: number; example: string };

export type Programme = {
  id: string;
  project: string;
  title: string;
  status: ProgrammeStatus;
  owner: string;
  startDate: string;
  endDate?: string;
  closingWindowDays: number;
  summary: string;
  scope: { target: string; kind: string; note: string }[];
  outOfScope: { target: string; note: string }[];
  tiers: Tier[];
  rules: string[];
  automatedScanning: string;
  disclosure: string;
  duplicates: string;
  events: EscrowEvent[];
  triagers: { name: string; wallet: string }[];
  /** Present when the programme was read from the escrow contract. Figures here are authoritative. */
  onChain?: OnChainState;
  /** Labelled test programme (from its metadata). */
  test?: boolean;
};

export type OnChainState = {
  programmeId: number;
  balance: number;
  totalFunded: number;
  totalPaid: number;
  closesAt: number | null; // unix seconds
  closingWindowSeconds: number;
  readAtBlock: number;
  metadataHash: string;
  metadataURI: string;
  metadataStatus: "verified" | "mismatch" | "unavailable";
};

export type Message = {
  from: "researcher" | "team";
  author: string;
  date: string;
  body: string;
  teamOnly?: boolean;
};

export type Report = {
  id: string;
  programmeId: string;
  reporter: string;
  title: string;
  category: string;
  target: string;
  suggested: Severity;
  confirmed?: Severity;
  status: ReportStatus;
  submitted: string;
  updated: string;
  reward?: number;
  reason?: string;
  digest: string;
  payoutTx?: string;
  payoutBlock?: number;
  impact: string;
  steps: string[];
  attachments: { name: string; size: string }[];
  thread: Message[];
};

// Deterministic hex so hashes stay stable between renders. Not a real hash function.
export function fakeHex(seed: string, bytes = 32): string {
  let h = 2166136261;
  let out = "";
  for (let i = 0; out.length < bytes * 2; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    out += (h & 0xff).toString(16).padStart(2, "0");
  }
  return "0x" + out.slice(0, bytes * 2);
}

const addr = (seed: string) => fakeHex(seed, 20);
const ev = (kind: EscrowEvent["kind"], amount: number, date: string, block: number, reportRef?: string): EscrowEvent => ({
  kind,
  amount,
  date,
  block,
  tx: fakeHex(`${kind}-${amount}-${block}`),
  reportRef,
});

export const RESEARCHER = addr("researcher-main");
export const ADMIN_WALLET = addr("platform-admin");
export const QUAYSIDE_OWNER = addr("quayside-owner");
export const ESCROW_CONTRACT = addr("sehat-escrow");
export const LATEST_BLOCK = 1_284_601;

const STANDARD_RULES = [
  "Test only against the contracts and hosts listed in scope, on Bohr testnet or a local fork. Never against mainnet funds that are not your own.",
  "No denial-of-service, spam, or load testing. No destructive tests, data exfiltration, privacy violations or social engineering of staff or users.",
  "If you reach personal data or keys by accident, stop, keep no copy, and say so in the report.",
  "Give the team the time in the disclosure window before you publish anything. Public disclosure needs both sides to agree.",
];

export const PROGRAMMES: Programme[] = [
  {
    id: "quayside-bridge",
    project: "Quayside",
    title: "Bridge relayer and proof verifier",
    status: "active",
    owner: addr("quayside-owner"),
    startDate: "2026-08-04",
    closingWindowDays: 30,
    summary: "The relayer and on-chain proof verifier that move BOT between Bohr testnet and mainnet.",
    scope: [
      { target: "ProofVerifier.sol", kind: "Smart contract", note: "Verification of batch proofs and epoch rollover" },
      { target: "BridgeVault.sol", kind: "Smart contract", note: "Locking and release of bridged BOT" },
      { target: "relayer (v1.4)", kind: "Off-chain service", note: "Batch building and submission" },
      { target: "EpochRegistry.sol", kind: "Smart contract", note: "Validator set changes" },
      { target: "api.quayside.example", kind: "Web API", note: "Public batch status endpoints only" },
    ],
    outOfScope: [
      { target: "quayside.example marketing site", note: "No reward-bearing findings" },
      { target: "Third-party RPC providers", note: "Report to the provider" },
      { target: "Known issues list", note: "Published in the repository's SECURITY.md" },
    ],
    tiers: [
      { severity: "Critical", min: 30_000, max: 60_000, example: "Release of bridged funds without a valid proof" },
      { severity: "High", min: 6_000, max: 20_000, example: "Relayer halted for a full epoch by one transaction" },
      { severity: "Medium", min: 2_000, max: 6_000, example: "Batch fees can be set outside the documented bounds" },
      { severity: "Low", min: 300, max: 1_000, example: "Event data that misreports a batch's size" },
      { severity: "Informational", min: 0, max: 200, example: "Gas improvements and documentation errors" },
    ],
    rules: STANDARD_RULES,
    automatedScanning: "Allowed against the testnet deployment at up to 5 requests a second. Not against the relayer's production endpoints.",
    disclosure: "90 days from the first report, or sooner if a fix ships and both sides agree.",
    duplicates: "The earliest complete report wins. Later reports of the same root cause close as duplicates without reward.",
    events: [
      ev("funded", 60_000, "2026-08-04", 1_102_310),
      ev("paid", 18_000, "2026-09-02", 1_171_884, "SHT-0121"),
      ev("funded", 40_000, "2026-09-21", 1_218_402),
      ev("paid", 7_000, "2026-09-28", 1_234_955, "SHT-0133"),
    ],
    triagers: [
      { name: "Kemi Okafor", wallet: addr("kemi") },
      { name: "Arvid Lund", wallet: addr("arvid") },
    ],
  },
  {
    id: "brindle-amm",
    project: "Brindle",
    title: "AMM v2 core contracts",
    status: "active",
    owner: addr("brindle-owner"),
    startDate: "2026-07-14",
    closingWindowDays: 30,
    summary: "Constant-product pools, the router and the fee switch for Brindle v2.",
    scope: [
      { target: "BrindlePair.sol", kind: "Smart contract", note: "Swaps, mint, burn" },
      { target: "BrindleRouter.sol", kind: "Smart contract", note: "Multi-hop swaps" },
      { target: "FeeSwitch.sol", kind: "Smart contract", note: "Protocol fee accounting" },
    ],
    outOfScope: [
      { target: "docs.brindle.example", note: "Documentation site" },
      { target: "Front-end at app.brindle.example", note: "UI-only issues" },
    ],
    tiers: [
      { severity: "Critical", min: 20_000, max: 40_000, example: "Draining a pool's reserves" },
      { severity: "High", min: 5_000, max: 12_000, example: "Locking LP funds permanently" },
      { severity: "Medium", min: 1_000, max: 3_000, example: "Fees miscounted against LPs" },
      { severity: "Low", min: 200, max: 600, example: "Rounding that favours one side by dust" },
      { severity: "Informational", min: 0, max: 100, example: "Gas and clarity" },
    ],
    rules: STANDARD_RULES,
    automatedScanning: "Allowed on a local fork only.",
    disclosure: "60 days from the first report.",
    duplicates: "The earliest complete report wins.",
    events: [
      ev("funded", 50_000, "2026-07-14", 1_046_002),
      ev("paid", 1_550, "2026-09-09", 1_189_330, "SHT-0139"),
      ev("paid", 450, "2026-10-02", 1_244_870, "SHT-0142"),
    ],
    triagers: [{ name: "Noor Haddad", wallet: addr("noor") }],
  },
  {
    id: "larkspur-lending",
    project: "Larkspur",
    title: "Lending markets and liquidator",
    status: "active",
    owner: addr("larkspur-owner"),
    startDate: "2026-08-25",
    closingWindowDays: 45,
    summary: "Isolated lending markets, the interest model and the liquidation engine.",
    scope: [
      { target: "LiquidationEngine.sol", kind: "Smart contract", note: "Liquidation bonus and seizure" },
      { target: "Market.sol", kind: "Smart contract", note: "Deposits, borrows, interest index" },
      { target: "OracleAdapter.sol", kind: "Smart contract", note: "Kestrel feed and staleness checks" },
      { target: "InterestModel.sol", kind: "Smart contract", note: "Rate curve" },
    ],
    outOfScope: [{ target: "Governance proposals", note: "Covered by Saltmarsh's programme" }],
    tiers: [
      { severity: "Critical", min: 15_000, max: 30_000, example: "Borrowing without collateral" },
      { severity: "High", min: 5_000, max: 12_000, example: "Liquidations at a stale price" },
      { severity: "Medium", min: 1_000, max: 3_000, example: "Interest accrued to the wrong side" },
      { severity: "Low", min: 200, max: 500, example: "Misleading events" },
      { severity: "Informational", min: 0, max: 100, example: "Gas and clarity" },
    ],
    rules: STANDARD_RULES,
    automatedScanning: "Allowed on a local fork only.",
    disclosure: "90 days from the first report.",
    duplicates: "The earliest complete report wins.",
    events: [
      ev("funded", 35_000, "2026-08-25", 1_160_441),
      ev("paid", 2_500, "2026-10-06", 1_253_002, "SHT-0144"),
    ],
    triagers: [{ name: "Tomás Ferreira", wallet: addr("tomas") }],
  },
  {
    id: "kestrel-oracle",
    project: "Kestrel",
    title: "Price oracle and keeper network",
    status: "active",
    owner: addr("kestrel-owner"),
    startDate: "2026-10-17",
    closingWindowDays: 30,
    summary: "Aggregated price feeds and the keepers that post them.",
    scope: [
      { target: "Aggregator.sol", kind: "Smart contract", note: "Median and deviation rules" },
      { target: "KeeperRegistry.sol", kind: "Smart contract", note: "Keeper bonds and rotation" },
    ],
    outOfScope: [{ target: "Upstream exchange APIs", note: "Report to the exchange" }],
    tiers: [
      { severity: "Critical", min: 10_000, max: 15_000, example: "Posting an arbitrary price" },
      { severity: "High", min: 3_000, max: 8_000, example: "Freezing a feed past its heartbeat" },
      { severity: "Medium", min: 800, max: 2_000, example: "Keeper rewards misallocated" },
      { severity: "Low", min: 150, max: 400, example: "Misleading events" },
      { severity: "Informational", min: 0, max: 100, example: "Gas and clarity" },
    ],
    rules: STANDARD_RULES,
    automatedScanning: "Not permitted.",
    disclosure: "60 days from the first report.",
    duplicates: "The earliest complete report wins.",
    events: [ev("funded", 18_000, "2026-10-17", 1_276_115)],
    triagers: [],
  },
  {
    id: "fennel-wallet",
    project: "Fennel",
    title: "Browser wallet signing flow",
    status: "paused",
    owner: addr("fennel-owner"),
    startDate: "2026-06-30",
    closingWindowDays: 30,
    summary: "The extension's transaction decoding and signing prompts.",
    scope: [
      { target: "fennel-extension (v3.2)", kind: "Browser extension", note: "Signing prompts and decoding" },
      { target: "Permit decoder", kind: "Library", note: "EIP-2612 and Permit2 parsing" },
    ],
    outOfScope: [{ target: "Mobile app", note: "Separate programme planned" }],
    tiers: [
      { severity: "Critical", min: 4_000, max: 6_000, example: "Signing a transaction the prompt did not show" },
      { severity: "High", min: 1_500, max: 3_000, example: "Prompt misrepresents the recipient" },
      { severity: "Medium", min: 500, max: 1_200, example: "Prompt hides a field" },
      { severity: "Low", min: 100, max: 300, example: "Confusing wording" },
      { severity: "Informational", min: 0, max: 50, example: "Clarity" },
    ],
    rules: STANDARD_RULES,
    automatedScanning: "Not applicable.",
    disclosure: "90 days from the first report.",
    duplicates: "The earliest complete report wins.",
    events: [
      ev("funded", 10_000, "2026-06-30", 1_016_280),
      ev("paid", 3_800, "2026-08-19", 1_148_610, "SHT-0118"),
    ],
    triagers: [],
  },
  {
    id: "marrow-staking",
    project: "Marrow",
    title: "Liquid staking vault",
    status: "closing",
    owner: addr("marrow-owner"),
    startDate: "2026-05-02",
    endDate: "2026-10-31",
    closingWindowDays: 30,
    summary: "The staking vault and withdrawal queue for mBOT.",
    scope: [
      { target: "StakingVault.sol", kind: "Smart contract", note: "Deposits and share price" },
      { target: "WithdrawalQueue.sol", kind: "Smart contract", note: "Exit ordering" },
    ],
    outOfScope: [{ target: "Validator operations", note: "Off-chain infrastructure" }],
    tiers: [
      { severity: "Critical", min: 3_000, max: 8_000, example: "Minting shares without deposit" },
      { severity: "High", min: 1_000, max: 3_000, example: "Withdrawals blocked" },
      { severity: "Medium", min: 400, max: 1_000, example: "Share price drift" },
      { severity: "Low", min: 100, max: 300, example: "Misleading events" },
      { severity: "Informational", min: 0, max: 50, example: "Clarity" },
    ],
    rules: STANDARD_RULES,
    automatedScanning: "Allowed on a local fork only.",
    disclosure: "60 days from the first report.",
    duplicates: "The earliest complete report wins.",
    events: [
      ev("funded", 12_000, "2026-05-02", 893_540),
      ev("paid", 6_000, "2026-07-21", 1_062_118, "SHT-0102"),
      ev("paid", 2_600, "2026-09-15", 1_203_771, "SHT-0131"),
    ],
    triagers: [],
  },
  {
    id: "saltmarsh-dao",
    project: "Saltmarsh",
    title: "Governance timelock",
    status: "active",
    owner: addr("saltmarsh-owner"),
    startDate: "2026-06-10",
    closingWindowDays: 30,
    summary: "The governor, timelock and treasury module.",
    scope: [
      { target: "Governor.sol", kind: "Smart contract", note: "Proposal and voting" },
      { target: "Timelock.sol", kind: "Smart contract", note: "Delay enforcement" },
    ],
    outOfScope: [{ target: "Forum and Snapshot space", note: "Off-chain" }],
    tiers: [
      { severity: "Critical", min: 5_000, max: 10_000, example: "Executing without the delay" },
      { severity: "High", min: 2_000, max: 5_000, example: "Blocking all proposals" },
      { severity: "Medium", min: 500, max: 1_500, example: "Vote miscount" },
      { severity: "Low", min: 100, max: 300, example: "Misleading events" },
      { severity: "Informational", min: 0, max: 50, example: "Clarity" },
    ],
    rules: STANDARD_RULES,
    automatedScanning: "Allowed on a local fork only.",
    disclosure: "90 days from the first report.",
    duplicates: "The earliest complete report wins.",
    events: [
      ev("funded", 15_000, "2026-06-10", 975_004),
      ev("paid", 10_000, "2026-08-30", 1_166_090, "SHT-0124"),
      ev("paid", 5_000, "2026-09-24", 1_226_300, "SHT-0136"),
    ],
    triagers: [],
  },
  {
    id: "oriel-names",
    project: "Oriel",
    title: "Name registry",
    status: "closed",
    owner: addr("oriel-owner"),
    startDate: "2026-04-01",
    endDate: "2026-07-31",
    closingWindowDays: 30,
    summary: "Registration, renewal and resolver contracts for .bot names.",
    scope: [{ target: "Registry.sol", kind: "Smart contract", note: "Registration and renewal" }],
    outOfScope: [],
    tiers: [
      { severity: "Critical", min: 3_000, max: 5_000, example: "Taking over a registered name" },
      { severity: "High", min: 1_000, max: 2_000, example: "Blocking renewals" },
      { severity: "Medium", min: 300, max: 800, example: "Wrong expiry" },
      { severity: "Low", min: 100, max: 200, example: "Misleading events" },
      { severity: "Informational", min: 0, max: 50, example: "Clarity" },
    ],
    rules: STANDARD_RULES,
    automatedScanning: "Allowed on a local fork only.",
    disclosure: "60 days from the first report.",
    duplicates: "The earliest complete report wins.",
    events: [
      ev("funded", 8_000, "2026-04-01", 825_660),
      ev("paid", 1_200, "2026-06-12", 979_210, "SHT-0097"),
      ev("withdrawn", 6_800, "2026-09-01", 1_169_002),
    ],
    triagers: [],
  },
];

// ---- derived escrow figures -------------------------------------------------------------------

const sum = (events: EscrowEvent[], kind: EscrowEvent["kind"]) =>
  events.filter((e) => e.kind === kind).reduce((t, e) => t + e.amount, 0);

// Contract state wins when present: the UI shows balances read from the contract, never sums of its own.
export const funded = (p: Programme) => p.onChain?.totalFunded ?? sum(p.events, "funded");
export const paidOut = (p: Programme) => p.onChain?.totalPaid ?? sum(p.events, "paid");
export const withdrawn = (p: Programme) =>
  p.onChain ? Math.max(0, round4(p.onChain.totalFunded - p.onChain.totalPaid - p.onChain.balance)) : sum(p.events, "withdrawn");
export const balance = (p: Programme) => p.onChain?.balance ?? funded(p) - paidOut(p) - withdrawn(p);
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** Rewards agreed but not yet released. The contract does not reserve these; the UI shows them. */
export const agreedUnpaid = (p: Programme) =>
  REPORTS.filter((r) => r.programmeId === p.id && r.status === "reward_agreed").reduce((t, r) => t + (r.reward ?? 0), 0);

export const acceptsRewards = (p: Programme) => p.status === "active" && balance(p) > 0;

export const maxCritical = (p: Programme) => p.tiers.find((t) => t.severity === "Critical")?.max ?? 0;

export const lastUpdated = (p: Programme) => p.events.map((e) => e.date).sort().at(-1) ?? p.startDate;

export const getProgramme = (id: string) => PROGRAMMES.find((p) => p.id === id);

// ---- reports ----------------------------------------------------------------------------------

const other = (seed: string) => addr(`researcher-${seed}`);
const steps3 = ["Fork Bohr testnet at the block in the attachment.", "Run the attached script against the listed contract.", "Compare the result with the expected value in the notes."];

export const REPORTS: Report[] = [
  {
    id: "SHT-0142",
    programmeId: "brindle-amm",
    reporter: RESEARCHER,
    title: "Fee rounding lets dust accrue to the first LP",
    category: "Arithmetic / rounding",
    target: "BrindlePair.sol",
    suggested: "Medium",
    confirmed: "Low",
    status: "paid",
    submitted: "2026-09-18",
    updated: "2026-10-02",
    reward: 450,
    digest: fakeHex("digest-0142"),
    payoutTx: PROGRAMMES[1].events[2].tx,
    payoutBlock: PROGRAMMES[1].events[2].block,
    impact: "Rounding in the protocol fee always rounds toward the first liquidity provider. Over a million swaps the drift is about 0.4 BOT per pool.",
    steps: steps3,
    attachments: [{ name: "rounding-fork-test.txt", size: "6 KB" }],
    thread: [
      { from: "team", author: "Noor Haddad", date: "2026-09-22", body: "Reproduced. The drift is real but bounded, so we are confirming Low rather than Medium." },
      { from: "researcher", author: "You", date: "2026-09-23", body: "Agreed, the bound holds. Low is fair." },
      { from: "team", author: "Noor Haddad", date: "2026-10-01", body: "Proposing 450 BOT, the top of the Low range." },
    ],
  },
  {
    id: "SHT-0157",
    programmeId: "quayside-bridge",
    reporter: RESEARCHER,
    title: "Relayer accepts a replayed proof after epoch rollover",
    category: "Replay / signature reuse",
    target: "ProofVerifier.sol",
    suggested: "Critical",
    confirmed: "Critical",
    status: "reward_agreed",
    submitted: "2026-10-03",
    updated: "2026-10-16",
    reward: 30_000,
    digest: fakeHex("digest-0157"),
    impact: "A proof signed by the outgoing validator set is still accepted for one block after the epoch changes, so a batch can be released twice.",
    steps: [
      "Fork Bohr testnet at block 1,251,900, two blocks before the epoch change.",
      "Submit batch 88412 with its original proof through the relayer.",
      "After the rollover block, submit the same proof again. BridgeVault releases the batch a second time.",
    ],
    attachments: [
      { name: "replay-fork-test.txt", size: "11 KB" },
      { name: "trace-1251902.png", size: "240 KB" },
    ],
    thread: [
      { from: "team", author: "Kemi Okafor", date: "2026-10-05", body: "Thank you. We reproduced it on a fork and have paused batch submission while we patch." },
      { from: "team", author: "Kemi Okafor", date: "2026-10-05", body: "Patch adds the epoch to the proof domain. Arvid to review before deploy.", teamOnly: true },
      { from: "team", author: "Arvid Lund", date: "2026-10-14", body: "Fix deployed to testnet. Confirming Critical. We propose 30,000 BOT, the bottom of the range, because the window is one block." },
      { from: "researcher", author: "You", date: "2026-10-16", body: "Accepted. Payout wallet is the one this report was submitted from." },
    ],
  },
  {
    id: "SHT-0163",
    programmeId: "larkspur-lending",
    reporter: RESEARCHER,
    title: "Liquidation bonus computed before the oracle staleness check",
    category: "Oracle / price manipulation",
    target: "LiquidationEngine.sol",
    suggested: "High",
    status: "triage",
    submitted: "2026-10-09",
    updated: "2026-10-15",
    digest: fakeHex("digest-0163"),
    impact: "The bonus is priced before the staleness check runs, so a liquidator can seize collateral at a price up to one heartbeat old.",
    steps: [
      "Fork Bohr testnet and let the Kestrel feed go 50 minutes without an update.",
      "Move the spot price 6% on the fork's pool.",
      "Call liquidate() on a position that is healthy at the fresh price. The bonus uses the stale price.",
    ],
    attachments: [{ name: "stale-liquidation.txt", size: "8 KB" }],
    thread: [
      { from: "team", author: "Tomás Ferreira", date: "2026-10-15", body: "Received and reproducing. One question: does this need the feed to be stale for the full heartbeat, or any delay?" },
      { from: "team", author: "Tomás Ferreira", date: "2026-10-15", body: "Likely High. Check whether the keeper rotation narrows the window.", teamOnly: true },
    ],
  },
  {
    id: "SHT-0170",
    programmeId: "fennel-wallet",
    reporter: RESEARCHER,
    title: "Signing prompt hides the target contract on long calldata",
    category: "UI misrepresentation",
    target: "fennel-extension (v3.2)",
    suggested: "Medium",
    status: "needs_information",
    submitted: "2026-10-11",
    updated: "2026-10-17",
    digest: fakeHex("digest-0170"),
    impact: "When calldata exceeds about 4 KB the prompt truncates before the target address, and the user signs without seeing which contract they call.",
    steps: ["Install Fennel 3.2 in a clean profile.", "Open the attached page and press Send.", "The prompt shows the method but not the target."],
    attachments: [{ name: "long-calldata.html", size: "5 KB" }],
    thread: [
      {
        from: "team",
        author: "Fennel security",
        date: "2026-10-17",
        body: "We cannot reproduce on 3.2.1. Which browser and extension build did you use, and does it happen with a hardware wallet connected?",
      },
    ],
  },
  {
    id: "SHT-0171",
    programmeId: "kestrel-oracle",
    reporter: RESEARCHER,
    title: "Keeper can front-run its own price update",
    category: "MEV / ordering",
    target: "KeeperRegistry.sol",
    suggested: "High",
    status: "duplicate",
    submitted: "2026-10-18",
    updated: "2026-10-19",
    reason: "Duplicate of an earlier report of the same root cause (SHT-0166).",
    digest: fakeHex("digest-0171"),
    impact: "A keeper sees its own update in the mempool and can trade against it before it lands.",
    steps: steps3,
    attachments: [],
    thread: [{ from: "team", author: "Kestrel team", date: "2026-10-19", body: "Thanks. This was reported a day earlier with the same root cause, so it closes as a duplicate." }],
  },
  {
    id: "SHT-0175",
    programmeId: "brindle-amm",
    reporter: RESEARCHER,
    title: "Missing content security policy on the docs site",
    category: "Web configuration",
    target: "docs.brindle.example",
    suggested: "Low",
    status: "out_of_scope",
    submitted: "2026-10-13",
    updated: "2026-10-14",
    reason: "docs.brindle.example is listed as out of scope.",
    digest: fakeHex("digest-0175"),
    impact: "The docs site sends no Content-Security-Policy header.",
    steps: ["Request any page on the docs site.", "Inspect the response headers."],
    attachments: [],
    thread: [{ from: "team", author: "Noor Haddad", date: "2026-10-14", body: "The docs site is out of scope for this programme, so we are closing this without reward. Thank you for flagging it." }],
  },
  {
    id: "SHT-0178",
    programmeId: "larkspur-lending",
    reporter: RESEARCHER,
    title: "Interest index stale for one block after unpause",
    category: "State / accounting",
    target: "Market.sol",
    suggested: "Medium",
    status: "submitted",
    submitted: "2026-10-19",
    updated: "2026-10-19",
    digest: fakeHex("digest-0178"),
    impact: "After unpause the first borrow in the block uses the index from before the pause.",
    steps: steps3,
    attachments: [{ name: "unpause-index.txt", size: "4 KB" }],
    thread: [],
  },
  // Other researchers' reports on Quayside, seen only by its team.
  ...(
    [
      ["SHT-0121", "Batch fee can be set above the documented cap", "Medium", "High", "paid", "2026-08-12", "2026-09-02", 18_000],
      ["SHT-0133", "EpochRegistry emits the old set on rotation", "Low", "High", "paid", "2026-09-10", "2026-09-28", 7_000],
      ["SHT-0149", "Relayer logs batch payloads at debug level", "High", undefined, "invalid", "2026-09-30", "2026-10-04", undefined],
      ["SHT-0152", "Replay of proofs across epochs", "Critical", undefined, "duplicate", "2026-10-04", "2026-10-06", undefined],
      ["SHT-0160", "Status API returns batches for any vault ID", "Medium", undefined, "needs_information", "2026-10-07", "2026-10-13", undefined],
      ["SHT-0165", "Verifier gas grows with validator count", "Low", undefined, "triage", "2026-10-10", "2026-10-15", undefined],
      ["SHT-0168", "Paused admin can set the batch fee to zero", "Medium", undefined, "submitted", "2026-10-16", "2026-10-16", undefined],
      ["SHT-0172", "Proof verifier accepts non-canonical field elements", "High", undefined, "submitted", "2026-10-18", "2026-10-18", undefined],
      ["SHT-0176", "Relayer RPC leaks pending batch contents", "Medium", undefined, "submitted", "2026-10-19", "2026-10-19", undefined],
    ] as const
  ).map(([id, title, suggested, confirmed, status, submitted, updated, reward], i): Report => {
    const paidEvent = PROGRAMMES[0].events.find((e) => e.reportRef === id);
    return {
      id,
      programmeId: "quayside-bridge",
      reporter: other(String(i % 4)),
      title,
      category: "Smart contract",
      target: "ProofVerifier.sol",
      suggested,
      confirmed,
      status,
      submitted,
      updated,
      reward,
      digest: fakeHex(`digest-${id}`),
      payoutTx: paidEvent?.tx,
      payoutBlock: paidEvent?.block,
      reason: status === "duplicate" ? "Duplicate of SHT-0157." : status === "invalid" ? "Debug logging is disabled in the production build." : undefined,
      impact: "Private to the Quayside team.",
      steps: steps3,
      attachments: [],
      thread: [],
    };
  }),
];

export const getReport = (id: string) => REPORTS.find((r) => r.id === id);
export const reportsFor = (programmeId: string) => REPORTS.filter((r) => r.programmeId === programmeId);
export const researcherReports = (wallet: string) => REPORTS.filter((r) => r.reporter === wallet);

// ---- moderation (admin) -----------------------------------------------------------------------

export type AbuseReport = {
  id: string;
  target: string;
  targetKind: "programme" | "report";
  reason: string;
  reporter: string;
  date: string;
  status: "open" | "hidden" | "dismissed";
};

export const ABUSE_REPORTS: AbuseReport[] = [
  { id: "AB-031", target: "kestrel-oracle", targetKind: "programme", reason: "Scope lists a contract address that belongs to another project.", reporter: other("9"), date: "2026-10-18", status: "open" },
  { id: "AB-030", target: "SHT-0174", targetKind: "report", reason: "Same text submitted to four programmes within ten minutes.", reporter: addr("brindle-owner"), date: "2026-10-16", status: "open" },
  { id: "AB-027", target: "oriel-names", targetKind: "programme", reason: "Programme closed while a report was unresolved.", reporter: other("2"), date: "2026-08-03", status: "dismissed" },
];

export type AuditEntry = { date: string; actor: string; action: string; target: string; reason: string };

export const AUDIT_LOG: AuditEntry[] = [
  { date: "2026-10-12 14:06", actor: "Admin · Leila Navarro", action: "Dismissed abuse report AB-029", target: "fennel-wallet", reason: "Pause was announced to researchers 7 days in advance." },
  { date: "2026-09-30 09:41", actor: "Admin · Leila Navarro", action: "Rejected report as spam", target: "SHT-0147", reason: "Generated text with no reproduction." },
  { date: "2026-08-03 16:20", actor: "Admin · Sam Whitfield", action: "Dismissed abuse report AB-027", target: "oriel-names", reason: "The open report was resolved inside the closing window." },
];

// ---- assertions: figures that must agree -------------------------------------------------------

if (process.env.NODE_ENV !== "production") {
  for (const p of PROGRAMMES) {
    console.assert(balance(p) >= 0, `${p.id}: negative balance`);
    for (const e of p.events.filter((x) => x.kind === "paid")) {
      const r = getReport(e.reportRef ?? "");
      if (r) console.assert(r.reward === e.amount && r.status === "paid", `${r.id}: payout event and report disagree`);
    }
  }
  const total = PROGRAMMES.reduce((t, p) => t + balance(p), 0);
  console.assert(total === 183_100, `escrow total ${total} differs from FRONTEND.md`);
}
