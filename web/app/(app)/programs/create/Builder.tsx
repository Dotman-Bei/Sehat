"use client";

import Link from "next/link";
import { useState } from "react";
import ConnectPrompt from "@/components/app/ConnectPrompt";
import Hash from "@/components/app/Hash";
import { useWallet } from "@/lib/wallet";
import { SEVERITIES, type Severity, fakeHex } from "@/lib/sample-data";
import { ACTIVE_NETWORK, CHAIN_LIVE, PREVIEW_DATA, txUrl } from "@/lib/config";
import { keccak256, type Hex } from "viem";
import { browserSender, explainError, fundProgramme, registerProgramme } from "@/lib/tx";
import { bot, TODAY } from "@/lib/format";
import { programmeName } from "@/lib/status";
import s from "./create.module.css";

type Target = { target: string; kind: string; note: string };
type TierRow = { severity: Severity; min: string; max: string };
type Phase = "idle" | "wallet" | "pending" | "done" | "failed";

const STEPS = ["Basics", "Scope", "Rules", "Rewards", "Dates", "Review", "Register", "Fund", "Publish"] as const;
type Step = (typeof STEPS)[number];

const KINDS = ["Smart contract", "Off-chain service", "Web API", "Browser extension", "Library", "Web app"];
const DEFAULT_RULES =
  "Test only against the targets in scope, on a local fork.\nNo denial-of-service, destructive tests, data exfiltration, privacy violations or social engineering.\nIf you reach personal data or keys by accident, stop, keep no copy, and say so in the report.\nDo not disclose publicly until both sides agree.";

const num = (v: string) => Number(v.replace(/[,\s]/g, ""));

export default function Builder() {
  const w = useWallet();
  const [step, setStepRaw] = useState<Step>("Basics");
  const [furthest, setFurthest] = useState(0);
  const setStep = (k: Step) => {
    setStepRaw(k);
    setFurthest((f) => Math.max(f, STEPS.indexOf(k)));
  };
  const [project, setProject] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [scope, setScope] = useState<Target[]>([{ target: "", kind: "Smart contract", note: "" }]);
  const [outScope, setOutScope] = useState<Target[]>([]);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [scanning, setScanning] = useState("Allowed on a local fork only.");
  const [disclosureDays, setDisclosureDays] = useState("90");
  const [tiers, setTiers] = useState<TierRow[]>(SEVERITIES.map((sv) => ({ severity: sv, min: "", max: "" })));
  const [start, setStart] = useState(TODAY);
  const [end, setEnd] = useState("");
  const [closing, setClosing] = useState("30");
  const [register, setRegister] = useState<TxState & { programmeId?: number }>({ phase: "idle" });
  const [fund, setFund] = useState<TxState & { amount?: number }>({ phase: "idle" });
  const [metadataUrl, setMetadataUrl] = useState("");
  const [amount, setAmount] = useState("");
  const [published, setPublished] = useState(false);

  // ---- validation per step -------------------------------------------------------------------
  const tierErrors = tiers.map((t) => {
    if (t.min === "" || t.max === "") return "Set both ends.";
    const lo = num(t.min), hi = num(t.max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0) return "Whole BOT only.";
    if (lo > hi) return "Minimum is above maximum.";
    return null;
  });
  const critMax = num(tiers[0].max) || 0;
  const problems: Record<Step, string | null> = {
    Basics: !project.trim() ? "Name the project." : title.trim().length < 6 ? "Give the programme a title." : null,
    Scope: scope.some((t) => !t.target.trim()) || scope.length === 0 ? "Every in-scope row needs a target." : null,
    Rules: rules.trim().length < 40 ? "Write the rules of engagement." : !/^\d+$/.test(disclosureDays) ? "Set the disclosure window in days." : null,
    Rewards: tierErrors.some(Boolean) ? "Complete every severity's range." : null,
    Dates: !start
      ? "Set a start date."
      : end && end <= start
        ? "The end date must come after the start."
        : !/^\d+$/.test(closing) || num(closing) < 7 || num(closing) > 365
          ? "The closing window must be 7 to 365 days."
          : null,
    Review: null,
    Register: register.phase !== "done" ? "Register the programme on-chain." : null,
    Fund: fund.phase !== "done" ? "Funding is not confirmed yet." : null,
    Publish: null,
  };
  const draftReady = (["Basics", "Scope", "Rules", "Rewards", "Dates"] as Step[]).every((k) => !problems[k]);
  const idx = STEPS.indexOf(step);
  const done = (k: Step) => {
    if (k === "Register") return register.phase === "done";
    if (k === "Fund") return fund.phase === "done";
    if (k === "Publish") return published;
    return STEPS.indexOf(k) < furthest && !problems[k];
  };
  const reachable = (k: Step) => {
    const i = STEPS.indexOf(k);
    if (i <= STEPS.indexOf("Review")) return true;
    if (k === "Register") return draftReady;
    if (k === "Fund") return register.phase === "done";
    return fund.phase === "done";
  };

  function runTx(set: (v: TxState & { amount?: number }) => void, seed: string, extra: { amount?: number } = {}) {
    set({ phase: "wallet", ...extra });
    setTimeout(() => {
      const hash = fakeHex(seed + Date.now());
      set({ phase: "pending", hash, ...extra });
      setTimeout(() => set({ phase: "done", hash, ...extra }), 1300);
    }, 900);
  }

  // ---- live chain: public metadata, registration and funding --------------------------------
  const metadataJson = JSON.stringify(
    {
      schema: "sehat.programme/1",
      project: project.trim(),
      title: title.trim(),
      summary: summary.trim(),
      scope: scope.filter((t) => t.target.trim()),
      outOfScope: outScope.filter((t) => t.target.trim()),
      tiers: tiers.map((t) => ({ severity: t.severity, min: String(num(t.min)), max: String(num(t.max)) })),
      rules: rules.split("\n").map((r) => r.trim()).filter(Boolean),
      automatedScanning: scanning.trim(),
      disclosure: `${disclosureDays} days from the first report.`,
      duplicates: "The earliest complete report wins.",
      start,
      end: end || null,
      triagers: [],
    },
    null,
    2,
  );
  const metadataHash = keccak256(new TextEncoder().encode(metadataJson));
  const metadataUrlOk = /^(https:\/\/|ipfs:\/\/)\S+$/.test(metadataUrl.trim());
  const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(metadataJson)}`;

  async function liveTx<T>(set: (v: TxState) => void, run: (onHash: (h: string) => void) => Promise<T>): Promise<T | null> {
    let hash: string | undefined;
    try {
      set({ phase: "wallet" });
      const out = await run((h) => {
        hash = h;
        set({ phase: "pending", hash: h });
      });
      return out;
    } catch (e) {
      set({ phase: "failed", hash, error: explainError(e) });
      return null;
    }
  }

  async function doRegister() {
    if (!CHAIN_LIVE) return runTx(setRegister, "register");
    const r = await liveTx(setRegister, (onHash) => registerProgramme(browserSender(w.address!), metadataHash as Hex, metadataUrl.trim(), num(closing), onHash));
    if (r) setRegister({ phase: "done", hash: r.receipt.transactionHash, programmeId: r.programmeId });
  }

  async function doFund() {
    if (!CHAIN_LIVE) return runTx(setFund, "fund", { amount: fundN });
    const amountText = amount.replace(/[,\s]/g, "");
    const r = await liveTx((v) => setFund({ ...v, amount: fundN }), (onHash) => fundProgramme(browserSender(w.address!), register.programmeId!, amountText, onHash));
    if (r) setFund({ phase: "done", hash: r.transactionHash, amount: fundN });
  }

  const next = () => setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const back = () => setStep(STEPS[Math.max(idx - 1, 0)]);
  const fundN = num(amount);
  const fundError = amount && (!Number.isFinite(fundN) || fundN <= 0) ? "Enter an amount in BOT." : null;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>New programme</h1>
          <p className="subline">
            Draft it, register it on {ACTIVE_NETWORK.name}, fund escrow in native BOT, then publish. Researchers see it only after the funding
            receipt confirms.
          </p>
        </div>
      </div>

      <div className={s.layout}>
        <nav className={s.steps} aria-label="Steps">
          <ol>
            {STEPS.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  className={s.stepBtn}
                  aria-current={k === step ? "step" : undefined}
                  disabled={!reachable(k)}
                  onClick={() => setStep(k)}
                >
                  <span className={s.stepName}>{k}</span>
                  <span className={s.stepState}>{done(k) ? "Done" : k === step ? "Now" : !reachable(k) ? "Locked" : ""}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className={s.body}>
          {step === "Basics" && (
            <Row title="Basics" help="Shown at the top of the programme page and in the directory.">
              <F label="Project name" id="b-project">
                <input id="b-project" className="input" value={project} onChange={(e) => setProject(e.target.value)} placeholder="The protocol or team name" />
              </F>
              <F label="Programme title" id="b-title">
                <input id="b-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What researchers will test" />
              </F>
              <F label="Public description" id="b-sum" hint="One or two sentences. No private contacts or vulnerability details.">
                <textarea id="b-sum" className="textarea" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </F>
            </Row>
          )}

          {step === "Scope" && (
            <>
              <Row title="In scope" help="Every target a researcher may test. Anything not listed can be closed as out of scope.">
                <Targets rows={scope} setRows={setScope} withKind />
              </Row>
              <Row title="Out of scope" help="Assets researchers must not test, with the reason.">
                <Targets rows={outScope} setRows={setOutScope} />
              </Row>
            </>
          )}

          {step === "Rules" && (
            <Row title="Rules of engagement" help="Researchers confirm these before every report. One rule per line.">
              <F label="Rules" id="r-rules">
                <textarea id="r-rules" className="textarea" rows={7} value={rules} onChange={(e) => setRules(e.target.value)} />
              </F>
              <F label="Automated scanning" id="r-scan">
                <input id="r-scan" className="input" value={scanning} onChange={(e) => setScanning(e.target.value)} />
              </F>
              <F label="Disclosure window (days)" id="r-days" hint="How long researchers wait before any public disclosure.">
                <input id="r-days" className="input num" inputMode="numeric" value={disclosureDays} onChange={(e) => setDisclosureDays(e.target.value)} style={{ maxWidth: 160 }} />
              </F>
            </Row>
          )}

          {step === "Rewards" && (
            <Row title="Reward tiers" help="Guidelines for each severity, in BOT. You confirm severity and agree the final amount per report; the contract only checks the balance.">
              <table className={`table ${s.tierTable}`}>
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th className="num">Minimum</th>
                    <th className="num">Maximum</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t, i) => (
                    <tr key={t.severity}>
                      <td className="cell-main">{t.severity}</td>
                      <td className="num">
                        <input className="input num" inputMode="numeric" aria-label={`${t.severity} minimum`} value={t.min} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))} />
                      </td>
                      <td className="num">
                        <input className="input num" inputMode="numeric" aria-label={`${t.severity} maximum`} value={t.max} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, max: e.target.value } : x)))} />
                        {t.min !== "" && t.max !== "" && tierErrors[i] && <div className={s.err}>{tierErrors[i]}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Row>
          )}

          {step === "Dates" && (
            <Row title="Dates and closing" help="Closing stops new reports. Reports already submitted keep the closing window to be resolved and paid.">
              <div className={s.pair}>
                <F label="Start" id="d-start">
                  <input id="d-start" type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
                </F>
                <F label="End" id="d-end" hint="Optional">
                  <input id="d-end" type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
                </F>
              </div>
              <F label="Closing window (days)" id="d-close">
                <input id="d-close" className="input num" inputMode="numeric" value={closing} onChange={(e) => setClosing(e.target.value)} style={{ maxWidth: 160 }} />
              </F>
              <p className={s.hint}>Between 7 and 365 days, fixed once registered. Unused escrow can be withdrawn only after the window ends; rewards can be paid until then.</p>
            </Row>
          )}

          {step === "Review" && (
            <Row title="Review" help="This is what researchers will see once the programme is funded and published.">
              <div className={s.preview}>
                <p className={s.previewTitle}>
                  {project || <span className="dash">Project</span>} {title || <span className="dash">programme title</span>}
                </p>
                <p className={s.hint}>{summary || "No description yet."}</p>
                <dl className="kv" style={{ marginTop: 12 }}>
                  <dt>In scope</dt>
                  <dd>{scope.filter((t) => t.target).map((t) => t.target).join(", ") || <span className="dash">—</span>}</dd>
                  <dt>Critical up to</dt>
                  <dd className="num">{critMax ? `${bot(critMax)} BOT` : <span className="dash">—</span>}</dd>
                  <dt>Disclosure</dt>
                  <dd>{disclosureDays} days</dd>
                  <dt>Runs</dt>
                  <dd>
                    {start}
                    {end ? ` to ${end}` : ", no end date"}
                  </dd>
                </dl>
              </div>
              <ul className={s.checklist}>
                {(["Basics", "Scope", "Rules", "Rewards", "Dates"] as Step[]).map((k) => (
                  <li key={k} data-ok={!problems[k] || undefined}>
                    <span>{k}</span>
                    <span>{problems[k] ?? "Ready"}</span>
                  </li>
                ))}
              </ul>
            </Row>
          )}

          {step === "Register" && (
            <Row title="Register on-chain" help="Creates the programme in the escrow contract with your wallet as owner. Only non-sensitive metadata and a content hash are written.">
              {!w.address ? (
                <ConnectPrompt sentence="Connect the wallet that will own this programme. It alone can release rewards and close the programme." preview={CHAIN_LIVE ? undefined : "Quayside owner"} />
              ) : (
                <>
                  {CHAIN_LIVE && register.phase !== "done" && (
                    <div className={s.metaBox}>
                      <p className={s.hint}>
                        The contract stores only a hash of your public programme details. Host this exact file where researchers can fetch it,
                        then give its address. Sehat checks the file against the hash before showing it.
                      </p>
                      <dl className="kv">
                        <dt>Metadata hash</dt>
                        <dd className="num">
                          <Hash value={metadataHash} head={8} tail={6} />
                        </dd>
                      </dl>
                      <a className="btn" href={downloadHref} download={`sehat-programme-${metadataHash.slice(2, 10)}.json`} style={{ justifySelf: "start" }}>
                        Download metadata file
                      </a>
                      <F label="Metadata address" id="r-url" hint="https:// or ipfs:// address of the downloaded file, unchanged.">
                        <input id="r-url" className="input" value={metadataUrl} onChange={(e) => setMetadataUrl(e.target.value)} placeholder="https://…/programme.json" aria-invalid={!!metadataUrl && !metadataUrlOk} />
                      </F>
                    </div>
                  )}
                  <TxBlock
                    phase={register.phase}
                    hash={register.hash}
                    error={register.error}
                    action="Register programme"
                    doneText={
                      CHAIN_LIVE && register.programmeId
                        ? `Registered as programme ${register.programmeId}. It holds no escrow yet, so researchers cannot submit to it.`
                        : "Registered. The programme exists on-chain but holds no escrow, so it is not visible to researchers."
                    }
                    disabled={w.wrongChain || (CHAIN_LIVE && !metadataUrlOk)}
                    onRun={doRegister}
                  />
                </>
              )}
            </Row>
          )}

          {step === "Fund" && (
            <Row title="Fund escrow" help="Native BOT, sent to the escrow contract with a payable call. The balance shown everywhere is read from the contract, never typed in.">
              {fund.phase === "done" ? (
                <TxBlock phase="done" hash={fund.hash} action="" doneText={`Funded with ${bot(fund.amount ?? 0)} BOT.`} onRun={() => {}} />
              ) : (
                <>
                  <F label="Amount (BOT)" id="f-amount" hint={critMax ? `Your Critical tier pays up to ${bot(critMax)} BOT.` : undefined}>
                    <input id="f-amount" className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50,000" style={{ maxWidth: 240 }} aria-invalid={!!fundError} />
                  </F>
                  {fundError && <p className={s.err}>{fundError}</p>}
                  {!fundError && fundN > 0 && critMax > fundN && (
                    <p className={s.warn}>
                      One Critical payout could need {bot(critMax)} BOT, more than this funding. The contract would refuse it until you add funds.
                    </p>
                  )}
                  <TxBlock
                    phase={fund.phase}
                    hash={fund.hash}
                    error={fund.error}
                    action={fundN > 0 && !fundError ? `Fund ${bot(fundN)} BOT` : "Fund escrow"}
                    doneText=""
                    disabled={!(fundN > 0) || !!fundError || w.wrongChain}
                    onRun={doFund}
                  />
                </>
              )}
            </Row>
          )}

          {step === "Publish" && (
            <Row title="Publish" help="Lists the programme in the directory and opens it to reports.">
              {CHAIN_LIVE ? (
                <div className={s.doneBox}>
                  <p className="cell-main">
                    {programmeName({ project, title })} is listed as programme {register.programmeId}.
                  </p>
                  <p className={s.hint}>
                    A registered, funded programme appears in the directory straight from the contract. There is no separate publish
                    transaction.
                  </p>
                  <Link className="btn btn-primary" href={`/programs/${register.programmeId}`} style={{ justifySelf: "start" }}>
                    Open the programme page
                  </Link>
                </div>
              ) : published ? (
                <div className={s.doneBox}>
                  <p className="cell-main">
                    {programmeName({ project, title })} is live.
                  </p>
                  <p className={s.hint}>Researchers can read the scope and rules and submit reports. Reports arrive on your programme dashboard.</p>
                  {PREVIEW_DATA && <p className={s.previewNote}>Preview build: nothing was registered, funded or published.</p>}
                  <Link className="btn btn-primary" href="/programs" style={{ justifySelf: "start" }}>
                    See the directory
                  </Link>
                </div>
              ) : (
                <>
                  <button className="btn btn-primary" disabled={fund.phase !== "done"} onClick={() => setPublished(true)}>
                    Publish programme
                  </button>
                  {fund.phase !== "done" && <p className={s.hint}>Funding not confirmed yet. Publish unlocks when the receipt lands.</p>}
                </>
              )}
            </Row>
          )}

          <div className={s.nav}>
            <button className="btn" onClick={back} disabled={idx === 0}>
              Back
            </button>
            {problems[step] && step !== "Register" && step !== "Fund" && <span className={s.problem}>{problems[step]}</span>}
            {step !== "Publish" && (
              <button className="btn btn-primary" onClick={next} disabled={!!problems[step] || !reachable(STEPS[idx + 1])}>
                Continue to {STEPS[idx + 1].toLowerCase()}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <section className={s.row} aria-labelledby={`row-${title}`}>
      <div className={s.rowLabel}>
        <h2 id={`row-${title}`}>{title}</h2>
        <p>{help}</p>
      </div>
      <div className={`panel ${s.rowPanel}`}>{children}</div>
    </section>
  );
}

function F({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className={s.hint}>{hint}</p>}
    </div>
  );
}

function Targets({ rows, setRows, withKind }: { rows: Target[]; setRows: (r: Target[]) => void; withKind?: boolean }) {
  const set = (i: number, patch: Partial<Target>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={s.targets}>
      {rows.length === 0 && <p className="dash">Nothing listed.</p>}
      {rows.map((r, i) => (
        <div key={i} className={withKind ? s.targetRow : s.targetRowShort}>
          <input className="input" aria-label="Target" placeholder={withKind ? "Contract, host or package" : "Asset"} value={r.target} onChange={(e) => set(i, { target: e.target.value })} />
          {withKind && (
            <select className="select" aria-label="Kind" value={r.kind} onChange={(e) => set(i, { kind: e.target.value })}>
              {KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          )}
          <input className="input" aria-label="Note" placeholder={withKind ? "What may be tested" : "Why it is excluded"} value={r.note} onChange={(e) => set(i, { note: e.target.value })} />
          <button className="btn btn-text" type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove ${r.target || "row"}`}>
            Remove
          </button>
        </div>
      ))}
      <button className="btn" type="button" style={{ justifySelf: "start" }} onClick={() => setRows([...rows, { target: "", kind: "Smart contract", note: "" }])}>
        Add target
      </button>
    </div>
  );
}

type TxState = { phase: Phase; hash?: string; error?: string };

function TxBlock({ phase, hash, error, action, doneText, disabled, onRun }: { phase: Phase; hash?: string; error?: string; action: string; doneText: string; disabled?: boolean; onRun: () => void }) {
  if (phase === "done") {
    return (
      <div className={s.doneBox}>
        <p>
          <span className="pill pill-positive">Confirmed</span>
        </p>
        <p>{doneText}</p>
        {hash && <Hash value={hash} href={txUrl(hash)} head={6} tail={6} />}
      </div>
    );
  }
  if (phase === "idle" || phase === "failed") {
    return (
      <>
        <button className="btn btn-primary" onClick={onRun} disabled={disabled} style={{ justifySelf: "start" }}>
          {phase === "failed" ? `Try again: ${action.toLowerCase()}` : action}
        </button>
        {phase === "failed" && (
          <p className={s.err} style={{ textAlign: "left" }}>
            {error} {hash && <Hash value={hash} href={txUrl(hash)} />}
          </p>
        )}
      </>
    );
  }
  return (
    <ol className={s.txSteps} aria-live="polite">
      <li data-state={phase === "wallet" ? "now" : "done"}>Confirm in your wallet</li>
      <li data-state={phase === "pending" ? "now" : "next"}>Waiting for the receipt {hash && <Hash value={hash} href={txUrl(hash)} />}</li>
      <li data-state="next">Confirmed</li>
      {!CHAIN_LIVE && <li className={s.previewNote}>Preview build: no transaction is sent.</li>}
    </ol>
  );
}
