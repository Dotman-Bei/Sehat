"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/live-report";
import { useWallet } from "@/lib/wallet";
import { signInWithWallet } from "./SignIn";

/** Lets a signed-in user flag a misleading or abusive programme for platform moderation. */
export default function ReportAbuse({ programmeId, project }: { programmeId: string; project: string }) {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.address ?? null))
      .catch(() => setMe(null));
  }, [open]);

  if (state === "done") return <p className="panel-meta">Thanks. Platform moderators will review it. Programme escrow is never affected by moderation.</p>;
  if (!open)
    return (
      <button className="btn btn-text" style={{ justifySelf: "start", paddingLeft: 0 }} onClick={() => setOpen(true)}>
        Report a problem with {project}
      </button>
    );

  return (
    <form
      style={{ display: "grid", gap: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setState("busy");
        try {
          if (!me) {
            if (!w.address) throw new Error("Connect a wallet first.");
            await signInWithWallet(w.address);
          }
          await postJson("/api/abuse", { targetKind: "programme", target: programmeId, reason });
          setState("done");
        } catch (err) {
          setError((err as Error).message);
          setState("idle");
        }
      }}
    >
      <label htmlFor="abuse-reason" style={{ fontWeight: 500 }}>
        What is wrong with this programme?
      </label>
      <textarea
        id="abuse-reason"
        className="textarea"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="For example: the scope lists contracts that belong to another project."
      />
      <p className="panel-meta">
        Do not describe vulnerabilities here; submit those privately to the programme.{" "}
        {me ? "" : w.address ? "You will be asked to sign in with your wallet." : "Connect a wallet to send this."}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" disabled={reason.trim().length < 10 || state === "busy" || (!me && !w.address)}>
          {state === "busy" ? "Sending…" : "Send to moderators"}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <p style={{ color: "var(--negative)" }}>{error}</p>}
    </form>
  );
}
