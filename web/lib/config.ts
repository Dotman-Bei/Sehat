// Network details from the BOT Chain quick guide. Recheck against
// https://dev-docs.botchain.ai/docs/Developers/quick-guide/ before any deployment.

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

export const ACTIVE_NETWORK: Network =
  NETWORKS[(process.env.NEXT_PUBLIC_SEHAT_NETWORK as Network["key"]) ?? "testnet"] ?? NETWORKS.testnet;

/** Escrow contract address; unset until the contract is deployed. */
export const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_SEHAT_ESCROW ?? "";

/** True while the app renders sample data instead of contract state and the API. */
export const PREVIEW_DATA = !ESCROW_ADDRESS;

export const txUrl = (hash: string) => `${ACTIVE_NETWORK.explorer}/tx/${hash}`;
export const addressUrl = (address: string) => `${ACTIVE_NETWORK.explorer}/address/${address}`;
