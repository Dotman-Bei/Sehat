"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { REPORTS_LIVE } from "@/lib/config";
import { postJson } from "@/lib/live-report";
import { bot } from "@/lib/format";
import s from "./submit.module.css";

type Props = {
  programme: {
    id: string;
    project: string;
    owner: string;
    triagers: string[];
    scope: string[];
    tiers: { severity: string; min: number; max: number }[];
  };
};

const CATEGORIES = [
  "Access control",
  "Arithmetic / rounding",
  "Oracle / price manipulation",
  "Replay / signature reuse",
  "Reentrancy",
  "State / accounting",
  "Logic halt (not load testing)",
  "UI misrepresentation",
  "Off-chain service",
  "Other",
];
const NOT_LISTED = "__not_listed";
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "text/plain"];
const MAX_FILES = 5;
const MAX_BYTES = 4 * 1024 * 1024;

type Field = "title" | "category" | "severity" | "target" | "impact" | "steps" | "wallet" | "confirm";
const FIELD_NAMES: Record<Field, string> = {
  title: "title",
  category: "category",
  severity: "suggested severity",
  target: "affected target",
  impact: "impact",
  steps: "reproduction steps",
  wallet: "payout wallet",
  confirm: "rules confirmation",
};

export default function ReportForm({ programme: p }: Props) {
  const wallet = useWallet();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [target, setTarget] = useState("");
  const [impact, setImpact] = useState("");
  const [steps, setSteps] = useState("");
  const [payout, setPayout] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [created, setCreated] = useState<{ id: string; ref: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  useEffect(() => {
    if (wallet.address && !payout) setPayout(wallet.address);
  }, [wallet.address, payout]);

  const errors = useMemo(() => {
    const e: Partial<Record<Field, string>> = {};
    if (title.trim().length < 8) e.title = "Give the report a short title of at least 8 characters.";
    if (!category) e.category = "Choose the closest category.";
    if (!severity) e.severity = "Suggest a severity. The team confirms the final one.";
    if (!target) e.target = "Choose the affected target.";
    if (impact.trim().length < 40) e.impact = "Describe the impact in at least 40 characters.";
    if (steps.trim().length < 40) e.steps = "Give steps the team can follow safely, at least 40 characters.";
    if (!/^0x[0-9a-fA-F]{40}$/.test(payout.trim())) e.wallet = "Enter a BOT Chain address: 0x followed by 40 hexadecimal characters.";
    if (!confirm) e.confirm = "Confirm that you followed the rules of engagement.";
    return e;
  }, [title, category, severity, target, impact, steps, payout, confirm]);

  const missing = Object.keys(errors) as Field[];
  const show = (f: Field) => (tried ? errors[f] : undefined);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFileError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ALLOWED.includes(f.type)) {
        setFileError(`${f.name}: only PDF, PNG, JPEG and plain text are accepted.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setFileError(`${f.name} is over 4 MB.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        setFileError(`At most ${MAX_FILES} files.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (missing.length) {
      document.getElementById(`f-${missing[0]}`)?.focus();
      return;
    }
    setState("sending");
    if (!REPORTS_LIVE) {
      setTimeout(() => setState("done"), 900);
      return;
    }
    void sendLive();
  }

  async function sendLive() {
    setServerError(null);
    try {
      const r = await postJson<{ id: string; ref: string }>("/api/reports", {
        programmeId: Number(p.id),
        title,
        category,
        suggested: severity,
        target,
        impact,
        steps,
        payoutWallet: payout.trim(),
        confirm,
      });
      setCreated(r);
      const failed: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/reports/${r.id}/attachments`, { method: "POST", body: fd });
        if (!res.ok) failed.push(`${file.name}: ${((await res.json().catch(() => ({}))) as { error?: string }).error ?? "upload failed"}`);
      }
      if (failed.length) setUploadNote(`The report was saved, but these files were not: ${failed.join("; ")}. Add them from the report page.`);
      setState("done");
    } catch (e) {
      setServerError((e as Error).message);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <section className={`panel ${s.done}`} aria-live="polite">
        <div className="panel-head">
          <h2>Report {created?.ref ?? "SHT-0179"} received</h2>
          <span className="pill">Submitted</span>
        </div>
        <dl className="kv" style={{ maxWidth: 520 }}>
          <dt>Reference</dt>
          <dd className="num">{created?.ref ?? "SHT-0179"}</dd>
          <dt>Programme</dt>
          <dd>{p.project}</dd>
          <dt>Suggested severity</dt>
          <dd>{severity}</dd>
          <dt>Payout wallet</dt>
          <dd className="num">{payout.slice(0, 6)}…{payout.slice(-4)}</dd>
        </dl>
        <p className={s.doneText}>
          Only you and the {p.project} team can open this report. Their questions and decisions arrive on your dashboard.
          Nothing has been written to the chain.
        </p>
        {uploadNote && <p className={s.err}>{uploadNote}</p>}
        {!REPORTS_LIVE && (
          <p className={s.previewNote}>Preview build: this report was not sent anywhere. In production it is stored privately with an access check on every read.</p>
        )}
        <div className={s.doneActions}>
          {created ? (
            <Link href={`/reports/${created.id}`} className="btn btn-primary">
              Open the private report
            </Link>
          ) : (
            <Link href="/researcher" className="btn btn-primary">
              Go to your reports
            </Link>
          )}
          <Link href={`/programs/${p.id}`} className="btn">
            Back to {p.project}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="with-rail">
      <form className={`panel ${s.form}`} onSubmit={submit} noValidate>
        <div className={s.field}>
          <label htmlFor="f-title">Title</label>
          <input id="f-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!show("title")} aria-describedby="e-title" placeholder="One line a triager can recognise later" />
          <Err id="e-title" msg={show("title")} />
        </div>

        <div className={s.pair}>
          <div className={s.field}>
            <label htmlFor="f-category">Category</label>
            <select id="f-category" className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-invalid={!!show("category")} aria-describedby="e-category">
              <option value="">Choose a category</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <Err id="e-category" msg={show("category")} />
          </div>
          <div className={s.field}>
            <label htmlFor="f-target">Affected target</label>
            <select id="f-target" className="select" value={target} onChange={(e) => setTarget(e.target.value)} aria-invalid={!!show("target")} aria-describedby="e-target">
              <option value="">Choose from the scope</option>
              {p.scope.map((t) => (
                <option key={t}>{t}</option>
              ))}
              <option value={NOT_LISTED}>Not listed in scope</option>
            </select>
            {target === NOT_LISTED && !show("target") && (
              <p className={s.warn}>Targets not in scope may be closed without reward. Check the programme&rsquo;s scope first.</p>
            )}
            <Err id="e-target" msg={show("target")} />
          </div>
        </div>

        <fieldset className={s.field} aria-describedby="e-severity">
          <legend id="f-severity" tabIndex={-1}>Suggested severity</legend>
          <div className={s.sevList} role="radiogroup" aria-labelledby="f-severity">
            {p.tiers.map((t) => (
              <label key={t.severity} className={s.sevRow} data-checked={severity === t.severity || undefined}>
                <input type="radio" name="severity" value={t.severity} checked={severity === t.severity} onChange={() => setSeverity(t.severity)} />
                <span className={s.sevName}>{t.severity}</span>
                <span className={`${s.sevRange} num`}>
                  {bot(t.min)}–{bot(t.max)} <span className="unit">BOT</span>
                </span>
              </label>
            ))}
          </div>
          <p className={s.help}>Your suggestion is shown beside the severity the team confirms. It does not guarantee acceptance or payment.</p>
          <Err id="e-severity" msg={show("severity")} />
        </fieldset>

        <div className={s.field}>
          <label htmlFor="f-impact">Impact</label>
          <textarea id="f-impact" className="textarea" rows={4} value={impact} onChange={(e) => setImpact(e.target.value)} aria-invalid={!!show("impact")} aria-describedby="e-impact" placeholder="What an attacker gains, what it costs users, and under which conditions" />
          <Err id="e-impact" msg={show("impact")} />
        </div>

        <div className={s.field}>
          <label htmlFor="f-steps">Reproduction steps</label>
          <textarea id="f-steps" className="textarea" rows={6} value={steps} onChange={(e) => setSteps(e.target.value)} aria-invalid={!!show("steps")} aria-describedby="e-steps" placeholder="Steps the team can follow on a local fork without touching user funds" />
          <Err id="e-steps" msg={show("steps")} />
        </div>

        <div className={s.field}>
          <span className={s.labelLike} id="f-files-label">
            Evidence <span className={s.optional}>optional</span>
          </span>
          <label className={`btn ${s.fileBtn}`}>
            Add files
            <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} aria-labelledby="f-files-label" />
          </label>
          {files.length > 0 && (
            <ul className={s.files}>
              {files.map((f, i) => (
                <li key={f.name + i}>
                  <span>{f.name}</span>
                  <span className="num dash">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                  <button type="button" className="btn btn-text" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className={s.help}>PDF, PNG, JPEG or plain text, up to 4 MB each and 5 files. Stored privately; Sehat never opens or runs them.</p>
          {fileError && <p className={s.err}>{fileError}</p>}
        </div>

        <div className={s.field}>
          <label htmlFor="f-wallet">Payout wallet</label>
          <input id="f-wallet" className="input num" value={payout} onChange={(e) => setPayout(e.target.value)} aria-invalid={!!show("wallet")} aria-describedby="e-wallet" placeholder="0x…" spellCheck={false} autoComplete="off" />
          <p className={s.help}>
            {wallet.address ? "Filled from your connected wallet. A reward is paid here only after the team agrees it." : "Connect a wallet to fill this in, or paste the address you want paid."}
          </p>
          <Err id="e-wallet" msg={show("wallet")} />
        </div>

        <label className={s.confirm}>
          <input id="f-confirm" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} aria-describedby="e-confirm" />
          <span>I followed {p.project}&rsquo;s rules of engagement and have the right to submit this report.</span>
        </label>
        <Err id="e-confirm" msg={show("confirm")} />

        <div className={s.submitRow}>
          <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
            {state === "sending" ? "Submitting…" : "Submit privately"}
          </button>
          {serverError && <p className={s.err} style={{ flexBasis: "100%" }}>{serverError}</p>}
          <p className={s.still} aria-live="polite">
            {missing.length ? `Still needed: ${missing.map((m) => FIELD_NAMES[m]).join(", ")}.` : "Ready to submit."}
          </p>
        </div>
      </form>

      <aside className="stack">
        <section className="panel">
          <div className="panel-head">
            <h2>Who can read this</h2>
          </div>
          <ul className={s.readers}>
            <li>
              <span>{p.project} owner</span>
              <span className="num dash">{p.owner}</span>
            </li>
            {p.triagers.map((t) => (
              <li key={t}>
                <span>{t}</span>
                <span className="dash">Triager</span>
              </li>
            ))}
            <li>
              <span>Platform operators</span>
              <span className="dash">Documented access only</span>
            </li>
          </ul>
          <p className={s.help} style={{ marginTop: 12 }}>
            Reports are stored privately with an access check on every read. They are not end-to-end encrypted.
          </p>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>What reaches the chain</h2>
          </div>
          <p className={s.chainText}>Nothing, unless a reward is paid. Then a public event records the programme, a digest of this report, your payout address and the amount.</p>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Before you submit</h2>
          </div>
          <ul className="prose">
            <li>No denial-of-service, destructive tests, data exfiltration or social engineering.</li>
            <li>If you reached personal data or keys by accident, say so here and keep no copy.</li>
            <li>Do not disclose publicly until the team agrees.</li>
          </ul>
          <Link href={`/programs/${p.id}#rules`} className={s.rulesLink}>
            Full rules for {p.project}
          </Link>
        </section>
      </aside>
    </div>
  );
}

function Err({ id, msg }: { id: string; msg?: string }) {
  return (
    <p id={id} className={s.err} hidden={!msg}>
      {msg}
    </p>
  );
}
