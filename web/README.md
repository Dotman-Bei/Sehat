# Sehat web app

Next.js 15 (App Router) + TypeScript + plain CSS. Design rules live in `../docs/FRONTEND.md`;
the escrow contract in `../contracts`.

## Modes

| Mode | When | Programmes, balances, escrow history | Reports, threads, triage |
|---|---|---|---|
| Preview | `NEXT_PUBLIC_SEHAT_ESCROW` unset | Sample data (`lib/sample-data.ts`) | Sample data |
| Chain live | `NEXT_PUBLIC_SEHAT_ESCROW` set | Read from the escrow contract; owner actions are real transactions | Sample data, labelled, until the reports API exists |

Every app screen states which data is sample. Preview identities (researcher, owner, admin) appear in
the wallet menu, or with `?as=researcher|owner|admin`, only while reports are sample data.

## Environment

Copy `.env.example` to `.env.local`.

```sh
NEXT_PUBLIC_SEHAT_NETWORK=testnet                       # or mainnet
NEXT_PUBLIC_SEHAT_ESCROW=0xbC555De32fb45a8FF3297cbbc1a6F50F7674Bb54   # Bohr testnet deployment
NEXT_PUBLIC_SEHAT_ESCROW_BLOCK=27529541                 # deploy block; event scans start here
# NEXT_PUBLIC_SEHAT_RPC=http://127.0.0.1:8545           # optional RPC override (local fork)
```

## How chain data works

- `lib/chain.ts` reads contract state (`getProgramme`, `programmeCount`) and escrow events with viem.
- `lib/programmes.ts` (server) builds each programme from contract state, its events and its public
  metadata. The metadata file is fetched from the URI in `ProgrammeRegistered` or the latest
  `MetadataUpdated`, and shown only if its keccak256 matches the hash stored on-chain. Otherwise the
  page says it could not be verified, and the programme takes no reports.
- Balances shown are contract state, never sums computed by the app. If the RPC's event index lags,
  the history is marked as catching up.
- Time rules (the closing window) are judged by the time of the block the page was read at.
- `lib/tx.ts` sends `register`, `fund`, `setPaused`, `startClosing`, `withdrawUnused` and
  `releaseReward`. Each is simulated first, so contract refusals appear in plain words before the wallet
  prompts, and reported done only after a successful receipt.
- Metadata for programmes registered by this team can be served from `public/metadata/<chainId>/<id>.json`.
  Those files are hashed on-chain: never edit them, and `.gitattributes` stops line-ending conversion.

## Commands

```sh
npm run dev                # preview mode unless .env.local sets the escrow address
npm run build
npm run lint
npm run test:chain         # live reads from Bohr + every write path on a local anvil fork (needs Foundry)
```

`release` is wired in `lib/tx.ts` and tested, but no screen calls it yet: a release needs a real
report digest from the reports API.
