import s from "./fragments.module.css";
import { bot, short, signed } from "@/lib/format";
import {
  type Programme,
  type Report,
  balance,
  funded,
  paidOut,
  maxCritical,
} from "@/lib/sample-data";
import { ACTIVE_NETWORK } from "@/lib/config";

export function EscrowTile({ p }: { p: Programme }) {
  const total = funded(p);
  const paid = paidOut(p);
  const left = balance(p);
  return (
    <div className={s.frag} data-ui>
      <p className={s.name}>{p.project}</p>
      <p className={s.sub}>{p.title}</p>
      <p className={s.label}>In escrow</p>
      <p className={`${s.figure} num`}>
        {bot(left)} <span className={s.unit}>BOT</span>
      </p>
      <div className={s.track} aria-hidden>
        <span className={s.trackPaid} style={{ width: `${(paid / total) * 100}%` }} />
        <span className={s.trackLeft} style={{ width: `${(left / total) * 100}%` }} />
      </div>
      <p className={`${s.trackLegend} num`}>
        <span>{bot(paid)} paid</span>
        <span>of {bot(total)}</span>
      </p>
      <dl className={s.kv}>
        <dt>Critical up to</dt>
        <dd className="num">{bot(maxCritical(p))} BOT</dd>
      </dl>
    </div>
  );
}

export function SealedReport({ r, project }: { r: Report; project: string }) {
  return (
    <div className={s.frag} data-ui>
      <div className={s.row}>
        <p className={`${s.name} num`}>{r.id}</p>
        <span className={s.pill}>Submitted</span>
      </div>
      <p className={s.sub}>{project}</p>
      <dl className={s.kv}>
        <dt>Title</dt>
        <dd className={s.sealed}>Team only</dd>
        <dt>Steps</dt>
        <dd className={s.sealed}>Team only</dd>
        <dt>Suggested</dt>
        <dd>{r.suggested}</dd>
        <dt>Digest</dt>
        <dd className="num">{short(r.digest)}</dd>
      </dl>
    </div>
  );
}

export function PayoutReceipt({ r, project }: { r: Report; project: string }) {
  return (
    <div className={s.frag} data-ui>
      <div className={s.row}>
        <p className={s.name}>Payout confirmed</p>
        <span className={`${s.pill} ${s.pillPositive}`}>Paid</span>
      </div>
      <p className={`${s.figure} num`}>
        {bot(r.reward ?? 0)} <span className={s.unit}>BOT</span>
      </p>
      <dl className={s.kv}>
        <dt>Programme</dt>
        <dd>{project}</dd>
        <dt>Report</dt>
        <dd className="num">{r.id}</dd>
        <dt>To</dt>
        <dd className="num">{short(r.reporter)}</dd>
        <dt>Block</dt>
        <dd className="num">{bot(r.payoutBlock ?? 0)}</dd>
        <dt>Tx</dt>
        <dd className="num">{short(r.payoutTx ?? "")}</dd>
      </dl>
      <p className={s.foot}>View on {ACTIVE_NETWORK.explorer.replace("https://", "")}</p>
    </div>
  );
}

export function TierTable({ p }: { p: Programme }) {
  return (
    <div className={s.frag} data-ui>
      <p className={s.name}>{p.project} reward tiers</p>
      <table className={s.table}>
        <tbody>
          {p.tiers.map((t) => (
            <tr key={t.severity}>
              <th scope="row">{t.severity}</th>
              <td className="num">
                {bot(t.min)}–{bot(t.max)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={s.foot}>Ranges in BOT. The team confirms severity.</p>
    </div>
  );
}

export function ScopeList({ p }: { p: Programme }) {
  return (
    <div className={s.frag} data-ui>
      <p className={s.name}>In scope</p>
      <p className={s.sub}>{p.project}</p>
      <ul className={s.list}>
        {p.scope.map((t) => (
          <li key={t.target}>
            <span>{t.target}</span>
            <span className={s.dim}>{t.kind}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TriageThread({ r, project }: { r: Report; project: string }) {
  const m = r.thread.at(-1);
  return (
    <div className={s.frag} data-ui>
      <div className={s.row}>
        <p className={`${s.name} num`}>{r.id}</p>
        <span className={`${s.pill} ${s.pillNotice}`}>Needs information</span>
      </div>
      <p className={s.sub}>{project}</p>
      {m && (
        <div className={s.msg}>
          <p className={s.msgAuthor}>
            {m.author} <span className={s.dim}>· {m.date}</span>
          </p>
          <p className={s.msgBody}>{m.body}</p>
        </div>
      )}
      <p className={s.action}>Reply</p>
    </div>
  );
}

export function FundingEvent({ p }: { p: Programme }) {
  const e = p.events.filter((x) => x.kind === "funded").at(-1)!;
  return (
    <div className={s.frag} data-ui>
      <div className={s.row}>
        <p className={s.name}>Escrow funded</p>
        <span className={`${s.pill} ${s.pillPositive}`}>Confirmed</span>
      </div>
      <p className={`${s.figure} num`}>
        {signed(e.amount)} <span className={s.unit}>BOT</span>
      </p>
      <dl className={s.kv}>
        <dt>Programme</dt>
        <dd>{p.project}</dd>
        <dt>Date</dt>
        <dd className="num">{e.date}</dd>
        <dt>Block</dt>
        <dd className="num">{bot(e.block)}</dd>
        <dt>Tx</dt>
        <dd className="num">{short(e.tx)}</dd>
      </dl>
    </div>
  );
}
