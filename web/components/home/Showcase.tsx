"use client";

import { useState } from "react";
import s from "./showcase.module.css";
import { bot, short } from "@/lib/format";
import { type Severity, balance, fakeHex, getProgramme, getReport } from "@/lib/sample-data";

type Viewer = "owner" | "researcher" | "chain";
const VIEWERS: { id: Viewer; label: string }[] = [
  { id: "owner", label: "Owner" },
  { id: "researcher", label: "Researcher" },
  { id: "chain", label: "Public chain" },
];

const report = getReport("SHT-0163")!;
const programme = getProgramme(report.programmeId)!;
const startBalance = balance(programme);
const tierOf = (sev: Severity) => programme.tiers.find((t) => t.severity === sev)!;
const CONFIRMABLE: Severity[] = ["High", "Medium", "Low"];
const payoutTx = fakeHex("showcase-release-0163");
const payoutBlock = 1_284_633;

export default function Showcase() {
  const [viewer, setViewer] = useState<Viewer>("owner");
  const [severity, setSeverity] = useState<Severity>("High");
  const [reward, setReward] = useState(9_500);
  const [paid, setPaid] = useState(false);
  const [refused, setRefused] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const tier = tierOf(severity);
  const escrow = paid ? startBalance - reward : startBalance;
  const teamNote = report.thread.find((m) => m.teamOnly);

  function pickSeverity(sev: Severity) {
    if (paid) return;
    setSeverity(sev);
    const t = tierOf(sev);
    setReward(Math.round((t.min + t.max) / 2 / 100) * 100);
  }

  function release() {
    if (viewer !== "owner") return;
    if (paid) {
      setRefused(true);
      return;
    }
    setPaid(true);
  }

  function reset() {
    setPaid(false);
    setRefused(false);
  }

  return (
    <div className={s.panel}>
      <div className={s.demo} data-ui aria-live="polite">
        <div className={s.demoHead}>
          <p className={`${s.ref} num`}>
            {report.id} <span className={s.dim}>· {programme.project}</span>
          </p>
          <span className={`${s.pill} ${paid ? s.pillPositive : ""}`}>{paid ? "Paid" : "Reward agreed"}</span>
        </div>

        {viewer === "chain" ? (
          <ChainView paid={paid} reward={reward} />
        ) : (
          <>
            <p className={s.title}>{report.title}</p>
            <dl className={s.facts}>
              <dt>Target</dt>
              <dd>{report.target}</dd>
              <dt>Severity</dt>
              <dd>
                {report.suggested} suggested · <strong>{severity} confirmed</strong>
              </dd>
              <dt>Reward</dt>
              <dd className="num">{bot(reward)} BOT to {short(report.reporter)}</dd>
            </dl>
            <p className={s.body}>{report.impact}</p>
            <ol className={s.steps}>
              {report.steps.map((st) => (
                <li key={st}>{st}</li>
              ))}
            </ol>
            {viewer === "owner" && teamNote ? (
              <div className={s.note}>
                <p className={s.noteHead}>Team only · {teamNote.author}</p>
                <p className={s.body}>{teamNote.body}</p>
              </div>
            ) : (
              <p className={s.hidden}>Programme notes are hidden unless the team shares them.</p>
            )}
          </>
        )}
      </div>

      <div className={s.controls}>
        <div className={s.ctl}>
          <span className={s.ctlName} id="ctl-viewer">Viewer</span>
          <div className={s.seg} role="radiogroup" aria-labelledby="ctl-viewer">
            {VIEWERS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={viewer === v.id}
                className={s.segBtn}
                onClick={() => setViewer(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className={s.ctl} data-extra={!moreOpen || undefined}>
          <span className={s.ctlName}>Suggested</span>
          <span className={s.ctlValue}>{report.suggested}</span>
        </div>

        <div className={s.ctl}>
          <span className={s.ctlName} id="ctl-sev">Confirmed</span>
          <div className={s.seg} role="radiogroup" aria-labelledby="ctl-sev">
            {CONFIRMABLE.map((sev) => (
              <button
                key={sev}
                type="button"
                role="radio"
                aria-checked={severity === sev}
                disabled={paid}
                className={s.segBtn}
                onClick={() => pickSeverity(sev)}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className={`${s.ctl} ${s.ctlTall}`}>
          <label className={s.ctlName} htmlFor="ctl-reward">
            Reward
          </label>
          <span className={`${s.ctlValue} num`}>{bot(reward)} BOT</span>
          <input
            id="ctl-reward"
            className={s.range}
            type="range"
            min={tier.min}
            max={tier.max}
            step={100}
            value={reward}
            disabled={paid}
            onChange={(e) => setReward(Number(e.target.value))}
            style={{ ["--fill" as string]: `${((reward - tier.min) / (tier.max - tier.min)) * 100}%` }}
          />
          <span className={`${s.rangeEnds} num`}>
            <span>{bot(tier.min)}</span>
            <span>{bot(tier.max)}</span>
          </span>
        </div>

        <div className={s.ctl} data-extra={!moreOpen || undefined}>
          <span className={s.ctlName}>Escrow left</span>
          <span className={`${s.ctlValue} num`}>{bot(escrow)} BOT</span>
        </div>

        <div className={s.ctl} data-extra={!moreOpen || undefined}>
          <span className={s.ctlName}>Paid to</span>
          <span className={`${s.ctlValue} num`}>{short(report.reporter)}</span>
        </div>

        <button type="button" className={s.more} onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}>
          {moreOpen ? "Fewer controls" : "More controls"}
        </button>

        <div className={s.releaseRow}>
          <button
            type="button"
            className={`button ${s.release}`}
            onClick={release}
            disabled={viewer !== "owner"}
          >
            {paid ? "Release again" : `Release ${bot(reward)} BOT`}
          </button>
          <p className={s.result} aria-live="polite">
            {viewer !== "owner"
              ? "Only the programme owner's wallet can release a reward."
              : refused
                ? "Refused: report reference already paid."
                : paid
                  ? `Paid in block ${bot(payoutBlock)}.`
                  : "Releases from Larkspur's escrow."}
          </p>
          {paid && (
            <button type="button" className={`link ${s.reset}`} onClick={reset}>
              Start over
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChainView({ paid, reward }: { paid: boolean; reward: number }) {
  const off = <span className={s.off}>Not on-chain</span>;
  return (
    <div className={s.chain}>
      <p className={s.chainHead}>{paid ? "RewardReleased event" : "No payout event yet"}</p>
      <dl className={s.facts}>
        <dt>Programme</dt>
        <dd className="num">{programme.id}</dd>
        <dt>Report digest</dt>
        <dd className="num">{paid ? short(report.digest, 6, 6) : off}</dd>
        <dt>Recipient</dt>
        <dd className="num">{paid ? short(report.reporter, 6, 6) : off}</dd>
        <dt>Amount</dt>
        <dd className="num">{paid ? `${bot(reward)} BOT` : off}</dd>
        <dt>Transaction</dt>
        <dd className="num">{paid ? short(payoutTx, 6, 6) : off}</dd>
        <dt>Title</dt>
        <dd>{off}</dd>
        <dt>Impact</dt>
        <dd>{off}</dd>
        <dt>Steps</dt>
        <dd>{off}</dd>
        <dt>Attachments</dt>
        <dd>{off}</dd>
      </dl>
      <p className={s.body}>
        {paid
          ? "Anyone can verify this payout on the explorer. Nobody can read the report from it."
          : "Until a reward is released, the chain holds nothing about this report at all."}
      </p>
    </div>
  );
}
