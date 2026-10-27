# Sehat web app

Next.js 15 (App Router) + TypeScript + plain CSS. Design rules live in `../docs/FRONTEND.md`;
the escrow contract in `../contracts`.

## Modes

| Mode | Set | Programmes, balances, escrow | Reports, threads, triage, moderation |
|---|---|---|---|
| Preview | nothing | Sample data (`lib/sample-data.ts`) | Sample data |
| Chain live | `NEXT_PUBLIC_SEHAT_ESCROW` | Read from the escrow contract; owner actions are wallet transactions | Sample data, labelled |
| Full live | escrow + `NEXT_PUBLIC_SEHAT_REPORTS=live` | As above | The private reports service in `server/` and `app/api/` |

Every screen states which data is sample. Preview identities (`?as=researcher|owner|admin`) exist only
while reports are sample data.

## Environment

Copy `.env.example` to `.env.local`.

```sh
NEXT_PUBLIC_SEHAT_ESCROW=0xD438c5aF89538Dc8a00ABCFB688c42ebBAA0463D   # BOT Chain mainnet deployment
NEXT_PUBLIC_SEHAT_ESCROW_BLOCK=27949448                 # deploy block; event scans start here
NEXT_PUBLIC_SEHAT_REPORTS=live                          # turn on the reports service
SEHAT_SESSION_SECRET=<32+ random characters>            # required in production
SEHAT_ADMINS=0xabc…,0xdef…                              # lowercase admin wallets (moderation only)
TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io           # hosted report database (required on Vercel)
TURSO_AUTH_TOKEN=<token>
# SEHAT_DB_FILE=.data/sehat.db                          # local default when TURSO_DATABASE_URL is unset
# NEXT_PUBLIC_SEHAT_RPC=http://127.0.0.1:8545           # RPC override (local fork)
```

## Chain data

- `lib/chain.ts` reads contract state and escrow events; `lib/programmes.ts` (server) builds each
  programme from them and from its public metadata, shown only if its keccak256 matches the hash stored
  on-chain. Balances shown are contract state; time rules use block time.
- `lib/tx.ts` sends `register`, `fund`, `setPaused`, `startClosing`, `withdrawUnused` and
  `releaseReward`, each simulated first and reported done only after a successful receipt.

## Reports service

**Sign-in.** Sign-In with Ethereum (EIP-4361): the wallet signs a one-time message (no transaction,
no gas). Nonces are single-use and expire after 10 minutes; the signature is verified for ordinary and
smart-contract wallets. The session is a 12-hour HMAC-signed, HTTP-only, SameSite=Lax cookie.

**Who can read a report.** Its researcher, the programme owner (read from the contract on each check,
cached 15 seconds) and triagers the owner authorised. Everyone else gets the same "not found" as for a
missing report. Team-only notes are hidden from the researcher. Platform admins see counts and abuse
reports, never report contents. Links use a random ID; references like SHT-0001 are for people.

**What goes on-chain.** Only `keccak256(abi.encode(ref, salt))`, with a random 32-byte salt that never
leaves the server, plus the recipient and the amount, in the payout event. A report is marked paid only
after the server finds a `RewardReleased` event with that digest, the payout wallet and the agreed amount
in a successful receipt.

**Rules enforced on the server.** Every field is validated. The programme must exist on-chain, verify
its metadata, accept reports and not be hidden. Triage transitions are limited, decisions that close a
report need a reason, only the owner agrees rewards (within the tier range and the escrow balance), and
paid or agreed reports cannot be re-triaged. Writes must come from this site (origin check). There are
rate limits on sign-in, reports, messages, uploads and abuse reports.

**Attachments.** At most 5 per report and 4 MB each (Vercel caps request bodies at 4.5 MB); PDF, PNG, JPEG or UTF-8 text, decided from the
bytes. Stored in the report database, never written to disk or executed, and served only as
downloads behind the report's access check, with `nosniff` and a sandboxing CSP.

**Logs.** The server logs the route and the error class only, never request bodies or report text.
The end-to-end test checks this.

**Storage and retention.** SQLite through libSQL: a hosted Turso database in production
(`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`), a file in `.data/sehat.db` (git-ignored) locally. Attachments
are stored in the same database, so Vercel's read-only file system is never used. Turn on Turso's backups
and keep the auth token in Vercel's encrypted environment variables only. Reports, threads, history and
attachments are kept for the life of the programme plus its disclosure window. Deleting a report's
contents must keep its digest, so a paid reference stays traceable. Retention periods and deletion
requests need a written policy before mainnet. Reports are not end-to-end encrypted.

**Known limits.** The contract cannot see reports, so closing a programme with unresolved reports is
the owner's responsibility within the closing window. A compromised owner wallet can agree and release
rewards up to the escrow balance. Disputes are not adjudicated. Moderation can hide programmes and
close spam, not move funds.

## Commands

```sh
npm run dev
npm run build
npm run lint
npm run test:chain     # live reads from mainnet + every write path on an anvil fork of it
npm run test:reports   # reports API end to end: auth, access, triage, attachments, verified payout, moderation
npm run test:ui        # the whole flow clicked through the browser, on a fork with a throwaway database
```

The tests need Foundry (`anvil`, `cast`) and Chrome or Edge. They never touch the real network or the
real database.
