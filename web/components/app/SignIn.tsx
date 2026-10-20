"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createWalletClient, custom, getAddress } from "viem";
import { createSiweMessage } from "viem/siwe";
import { postJson } from "@/lib/live-report";
import { ACTIVE_NETWORK, VIEM_CHAIN } from "@/lib/config";
import { useWallet } from "@/lib/wallet";
import ConnectPrompt from "./ConnectPrompt";

/** Signs a Sign-In with Ethereum message with the connected wallet. No transaction, no gas. */
export async function signInWithWallet(address: string) {
  if (!window.ethereum) throw new Error("No browser wallet found.");
  const account = getAddress(address);
  const { nonce } = await postJson<{ nonce: string }>("/api/auth/nonce", {});
  const message = createSiweMessage({
    address: account,
    chainId: ACTIVE_NETWORK.chainId,
    domain: window.location.host,
    uri: window.location.origin,
    nonce,
    version: "1",
    issuedAt: new Date(),
    statement: "Sign in to Sehat to read and write private reports. This does not send a transaction or cost gas.",
  });
  const wallet = createWalletClient({ chain: VIEM_CHAIN, transport: custom(window.ethereum) });
  const signature = await wallet.signMessage({ account, message });
  await postJson("/api/auth/verify", { message, signature });
}

export async function signOut() {
  await postJson("/api/auth/logout", {});
}

/** The frame of a private screen when no session exists: connect, then sign in. */
export default function SignInPanel({ sentence }: { sentence: string }) {
  const w = useWallet();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!w.address) return <ConnectPrompt sentence={sentence} />;

  return (
    <div className="panel" style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <p>{sentence}</p>
      <div>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await signInWithWallet(w.address!);
              router.refresh();
            } catch (e) {
              const m = (e as Error).message ?? "";
              setError(/reject|denied/i.test(m) ? "Signing was rejected in the wallet." : m || "Sign-in failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Waiting for your signature…" : "Sign in with this wallet"}
        </button>
      </div>
      {error && <p style={{ color: "var(--negative)" }}>{error}</p>}
      <p className="panel-meta">Signing proves you control the wallet. It does not send a transaction or cost gas.</p>
    </div>
  );
}
