"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ACTIVE_NETWORK, PREVIEW_DATA } from "./config";
import { ADMIN_WALLET, QUAYSIDE_OWNER, RESEARCHER } from "./sample-data";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, fn: (...a: unknown[]) => void) => void;
  removeListener?: (event: string, fn: (...a: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export type PreviewIdentity = { label: string; address: string; note: string };

/** Preview identities exist only while the build shows sample data. They are labelled as such everywhere. */
export const PREVIEW_IDENTITIES: PreviewIdentity[] = PREVIEW_DATA
  ? [
      { label: "Researcher", address: RESEARCHER, note: "7 sample reports" },
      { label: "Quayside owner", address: QUAYSIDE_OWNER, note: "Owns Quayside Bridge" },
      { label: "Platform admin", address: ADMIN_WALLET, note: "Moderation only" },
    ]
  : [];

type WalletState = {
  address: string | null;
  chainId: number | null;
  kind: "browser" | "preview" | null;
  wrongChain: boolean;
  error: string | null;
  connecting: boolean;
  hasBrowserWallet: boolean;
  connectBrowser: () => Promise<void>;
  connectPreview: (address: string) => void;
  switchChain: () => Promise<void>;
  disconnect: () => void;
};

const Ctx = createContext<WalletState | null>(null);
const KEY = "sehat.wallet";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [kind, setKind] = useState<WalletState["kind"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasBrowserWallet, setHasBrowserWallet] = useState(false);

  // Restore a preview identity for this tab only.
  useEffect(() => {
    setHasBrowserWallet(typeof window !== "undefined" && !!window.ethereum);
    // Preview links: ?as=researcher | owner | admin selects a labelled preview identity.
    const as = new URLSearchParams(window.location.search).get("as");
    const byParam = as && PREVIEW_IDENTITIES.find((p) => p.label.toLowerCase().includes(as.toLowerCase()));
    if (byParam) {
      setAddress(byParam.address);
      setKind("preview");
      setChainId(ACTIVE_NETWORK.chainId);
      return;
    }
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved && PREVIEW_IDENTITIES.some((p) => p.address === saved)) {
        setAddress(saved);
        setKind("preview");
        setChainId(ACTIVE_NETWORK.chainId);
      }
    } catch {
      /* storage unavailable: start disconnected */
    }
  }, []);

  useEffect(() => {
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!eth?.on || kind !== "browser") return;
    const onAccounts = (...a: unknown[]) => {
      const list = a[0] as string[];
      setAddress(list?.[0]?.toLowerCase() ?? null);
      if (!list?.length) setKind(null);
    };
    const onChain = (...a: unknown[]) => setChainId(parseInt(String(a[0]), 16));
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [kind]);

  const connectBrowser = useCallback(async () => {
    setError(null);
    const eth = window.ethereum;
    if (!eth) {
      setError("No browser wallet found. Install one that supports BOT Chain, then try again.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const id = parseInt(String(await eth.request({ method: "eth_chainId" })), 16);
      setAddress(accounts[0]?.toLowerCase() ?? null);
      setChainId(id);
      setKind("browser");
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
    } catch (e) {
      setError((e as { code?: number }).code === 4001 ? "Connection request rejected in the wallet." : "The wallet did not connect. Try again.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchChain = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    const hex = "0x" + ACTIVE_NETWORK.chainId.toString(16);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      if ((e as { code?: number }).code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hex,
              chainName: ACTIVE_NETWORK.name,
              nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
              rpcUrls: [ACTIVE_NETWORK.rpc],
              blockExplorerUrls: [ACTIVE_NETWORK.explorer],
            },
          ],
        });
      } else {
        setError("The network switch was not completed.");
      }
    }
  }, []);

  const connectPreview = useCallback((addr: string) => {
    setAddress(addr);
    setKind("preview");
    setChainId(ACTIVE_NETWORK.chainId);
    setError(null);
    try {
      sessionStorage.setItem(KEY, addr);
    } catch {}
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setKind(null);
    setChainId(null);
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      kind,
      wrongChain: !!address && chainId !== null && chainId !== ACTIVE_NETWORK.chainId,
      error,
      connecting,
      hasBrowserWallet,
      connectBrowser,
      connectPreview,
      switchChain,
      disconnect,
    }),
    [address, chainId, kind, error, connecting, hasBrowserWallet, connectBrowser, connectPreview, switchChain, disconnect],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}

export const sameAddress = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
