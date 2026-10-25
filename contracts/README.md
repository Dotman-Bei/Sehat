# SehatEscrow

The on-chain half of Sehat: escrow for bug-bounty programmes on BOT Chain, in native BOT.
Report contents, triage and severity decisions stay off-chain. The contract holds the money and
enforces a few rules about how it can leave.

## What the contract guarantees

- A programme's escrow leaves only through `releaseReward` (to a researcher) or `withdrawUnused`
  (to the owner, after the closing window).
- Only the programme owner can release or withdraw. Nobody else can move a programme's funds,
  including the platform guardian.
- A reward never exceeds the programme's balance, and a programme pays each report reference once.
- Plain BOT transfers to the contract revert, so every wei held belongs to one programme's balance.

## What it does not do

It does not judge whether a report is valid, pick the severity or the amount, or force an owner to
pay. The owner decides and signs the release. It also cannot see reports, so it cannot tell whether
any are unresolved when a programme closes. It only enforces the closing window.

## Lifecycle

```text
register (Active) ──fund──▶ Active ⇄ Paused ──startClosing──▶ Closing ──(window ends)── withdrawUnused ──▶ Closed
                     releaseReward allowed in Active, Paused and Closing
```

| Function | Who | When | Effect |
|---|---|---|---|
| `register(metadataHash, uri, closingWindow)` payable | anyone (becomes owner) | not guardian-paused | New programme; any value sent funds it. Window 7–365 days, fixed. |
| `fund(id)` payable | owner | Active or Paused | Adds BOT to escrow. |
| `releaseReward(id, reportRef, recipient, amount)` | owner | Active, Paused or Closing | Pays a researcher. Refuses a paid ref, zero values and amounts over balance. |
| `setPaused(id, bool)` | owner | Active ⇄ Paused | Signals that no new reports are accepted. Funding and payouts continue. |
| `startClosing(id)` | owner | Active or Paused | Irreversible. Starts the closing window; funding stops. |
| `withdrawUnused(id, to)` | owner | Closing, after the window | Sends the rest to `to` and closes for good. |
| `updateMetadata(id, hash, uri)` | owner | not Closed | Points to new public metadata. |
| `transferProgrammeOwnership` / `acceptProgrammeOwnership` | owner / new owner | any | Two-step handover. |
| `guardianPause(duration)` / `guardianUnpause()` | guardian | any | Blocks register, fund, release and withdraw for at most 7 days per call. |

## Report references and privacy

`reportRef` must be a salted digest computed by the reports service, for example
`keccak256(abi.encode(reportId, secretSalt))`, with the salt kept server-side. A bare report ID would
let anyone link payouts to reports. Events carry only the programme ID, the digest, the recipient
and the amount.

## Threat model (contract)

| Threat | Mitigation | Residual risk |
|---|---|---|
| Reentrancy or accounting error in payout | Checks-effects-interactions, a reentrancy lock, fuzz tests and 4 invariants (funds conserved, balances sum to holdings, no double payment) | Needs an independent review before mainnet |
| Unauthorised release or withdrawal | Owner-only on every money path; the guardian has no money path | A compromised owner key can pay itself up to the balance. Use a multisig owner for large programmes. |
| Duplicate payout | `isPaid[programmeId][reportRef]` set before the transfer | A different ref for the same finding is an off-chain mistake the contract cannot detect |
| Payout larger than escrow | `InsufficientEscrow` check; programmes cannot spend each other's balance | None |
| Programme closes with unresolved reports | Window of at least 7 days, fixed at registration; payouts continue during it | The contract cannot see reports. Researchers rely on the owner resolving them inside the window. |
| Guardian abuse | Pause expires after at most 7 days; no funds or programme control | A guardian can re-pause repeatedly. Use a multisig guardian with published procedures. |
| Validator timestamp drift | Windows are measured in days | Seconds of drift are immaterial |
| Recipient that rejects BOT | The release reverts and the ref stays unpaid | The owner must pay a different address |

## Commands

```sh
forge build
forge test                 # 48 tests: unit, fuzz and invariant
forge coverage --report summary
forge snapshot             # gas
./script/export-abi.sh     # regenerate web/lib/escrow-abi.ts
```

## Deploying to Bohr testnet

Network values were checked on 2026-10-20 against the
[BOT Chain quick guide](https://dev-docs.botchain.ai/docs/Developers/quick-guide/) and the live RPC:
Bohr testnet is chain 968 at `https://rpc.bohr.life`, with Blockscout at `https://scan.bohr.life`.
The node supports Cancun opcodes. Recheck all of this before each deployment.

1. Give the script a signer, using a wallet made only for deploying and holding only testnet BOT:
   - `PRIVATE_KEY` and `GUARDIAN` in `contracts/.env` (git-ignored; template in `.env.example`), or
   - an encrypted keystore: `cast wallet import sehat-deployer --interactive`
2. Fund it from the faucet at https://faucet.botchain.ai/basic. Deployment needs about 0.055 BOT
   at 20 gwei (simulated against Bohr).
3. Deploy and verify:
   ```sh
   # with contracts/.env
   forge script script/Deploy.s.sol --rpc-url bohr --broadcast \
     --verify --verifier blockscout --verifier-url https://scan.bohr.life/api/

   # or with the keystore
   GUARDIAN=0xYourGuardian forge script script/Deploy.s.sol --rpc-url bohr \
     --account sehat-deployer --broadcast \
     --verify --verifier blockscout --verifier-url https://scan.bohr.life/api/
   ```
4. Put the address in `web/.env.local` as `NEXT_PUBLIC_SEHAT_ESCROW=0x…`, with
   `NEXT_PUBLIC_SEHAT_NETWORK=testnet`.

## Deploying to BOT Chain mainnet

Gas on BOT Chain has no base fee and a hard 20 gwei floor (lower prices are rejected as
"gasPrice too low", probed 2026-10-25), so the only saving is gas used. The contract is compiled with
the IR pipeline at 200 optimiser runs, which halves the bytecode:

| Compiler setting | Deploy gas | Cost at 20 gwei |
|---|---|---|
| 10,000 runs, legacy pipeline (testnet build) | 2,126,430 | 0.0425 BOT |
| 200 runs, legacy pipeline | 1,655,483 | 0.0331 BOT |
| **200 runs, IR pipeline (current)** | **1,131,081** | **0.0226 BOT** |

User actions cost 0.3–0.6% more gas under the IR build (at most about 950 gas per call); all 48 tests pass.
Keep the gas buffer at 10%: the wallet needs about 0.025 BOT up front, and the unused part is refunded.

```sh
GUARDIAN=0x… forge script script/Deploy.s.sol --rpc-url botchain --broadcast --gas-estimate-multiplier 110   --verify --verifier blockscout --verifier-url https://scan.botchain.ai/api/
```

Mainnet (chain 677) only after an independent review and the PRD's security, legal and operational
gates.
