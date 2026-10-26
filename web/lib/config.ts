// Network details from the BOT Chain quick guide. Recheck against
// https://dev-docs.botchain.ai/docs/Developers/quick-guide/ before any deployment.

import { defineChain } from "viem";

export type Network = {
  key: "mainnet" | "testnet";
  name: string;
  chainId: number;
  rpc: string;
  explorer: string;
};

export const NETWORKS: Record<Network["key"], Network> = {
  mainnet: {
    key: "mainnet",
    name: "BOT Chain mainnet",
    chainId: 677,
    rpc: "https://rpc.botchain.ai",
    explorer: "https://scan.botchain.ai",
  },
  testnet: {
    key: "testnet",
    name: "Bohr testnet",
    chainId: 968,
    rpc: "https://rpc.bohr.life",
    explorer: "https://scan.bohr.life",
  },
};

const base = NETWORKS[(process.env.NEXT_PUBLIC_SEHAT_NETWORK as Network["key"]) ?? "testnet"] ?? NETWORKS.testnet;

/** The active network. NEXT_PUBLIC_SEHAT_RPC overrides the RPC (for a local fork in tests). */
export const ACTIVE_NETWORK: Network = { ...base, rpc: process.env.NEXT_PUBLIC_SEHAT_RPC || base.rpc };

export const VIEM_CHAIN = defineChain({
  id: ACTIVE_NETWORK.chainId,
  name: ACTIVE_NETWORK.name,
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [ACTIVE_NETWORK.rpc] } },
  blockExplorers: { default: { name: "Blockscout", url: ACTIVE_NETWORK.explorer } },
});

/** Escrow contract address; unset until the app should read from the contract. */
export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_SEHAT_ESCROW ?? "") as `0x${string}` | "";
/** Block the escrow contract was deployed in; event scans start here. */
export const ESCROW_DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_SEHAT_ESCROW_BLOCK || "0");

/** Programmes, balances and escrow events come from the contract. */
export const CHAIN_LIVE = /^0x[0-9a-fA-F]{40}$/.test(ESCROW_ADDRESS);
/** Reports, threads and triage come from the private reports API (needs the chain to be live). */
export const REPORTS_LIVE = CHAIN_LIVE && process.env.NEXT_PUBLIC_SEHAT_REPORTS === "live";

/** Sample programmes and balances are shown (no escrow configured). */
export const PREVIEW_DATA = !CHAIN_LIVE;

export const txUrl = (hash: string) => `${ACTIVE_NETWORK.explorer}/tx/${hash}`;
export const addressUrl = (address: string) => `${ACTIVE_NETWORK.explorer}/address/${address}`;

/** BOT Chain's own site and explorer, credited in every footer. */
export const BOTCHAIN_SITE = "https://www.botchain.ai";
export const BOTCHAIN_EXPLORER = NETWORKS.mainnet.explorer;
