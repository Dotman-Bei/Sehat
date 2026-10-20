"use client";

import { PREVIEW_IDENTITIES, useWallet } from "@/lib/wallet";

/** The frame of a screen that needs a wallet: one sentence, the browser wallet, and the labelled preview identity. */
export default function ConnectPrompt({ sentence, preview }: { sentence: string; preview?: string }) {
  const w = useWallet();
  const identity = PREVIEW_IDENTITIES.find((p) => p.label === preview);
  return (
    <div className="panel" style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <p>{sentence}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={w.connectBrowser} disabled={w.connecting}>
          {w.connecting ? "Waiting for wallet…" : "Connect wallet"}
        </button>
        {identity && (
          <button className="btn" onClick={() => w.connectPreview(identity.address)}>
            Preview as {identity.label.toLowerCase()} (sample data)
          </button>
        )}
      </div>
      {w.error && <p style={{ color: "var(--negative)" }}>{w.error}</p>}
      <p className="panel-meta">Sehat never asks for a seed phrase or private key.</p>
    </div>
  );
}
