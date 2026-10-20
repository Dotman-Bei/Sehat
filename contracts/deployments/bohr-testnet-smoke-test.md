# Bohr testnet smoke test, 2026-10-20

Contract `0xbC555De32fb45a8FF3297cbbc1a6F50F7674Bb54` (chain 968), owner and deployer
`0x1727eF2a5622B8559Af818A942dBFd59493e175E`. Programme 1 is a labelled test programme
("Escrow smoke test (not a real bounty)"); its public metadata is `web/public/metadata/968/1.json`,
keccak256 `0x8549f555…a26c`, recorded on-chain at registration.

| Step | Expected | Result |
|---|---|---|
| Register programme 1 with 0.1 BOT, 7-day closing window | Escrow reads 0.1 BOT | Tx `0xda064a31164267b8a7835b3ae029ab22572ebb0dfc274a92528753019dcac593`, block 27,530,496. Balance 0.1 BOT |
| Release 0.02 BOT for report ref `0x4bf56466…b562` to `0x581B2a375dF66Af38756B3dc6CAD1D1491d069Bb` | Recipient +0.02, escrow 0.08, ref marked paid | Tx `0x86ed0d2027481eaae18dbe36d2a068cf292a26e7b97ff4416566d65620e5b1d4`, block 27,530,510. Recipient 0.02, escrow 0.08, `isPaid` true |
| Release the same ref again | Refused | Reverted `AlreadyPaid` (`0xf4b76a0e`); no transaction sent |
| Release 1 BOT (more than escrow) | Refused | Reverted `InsufficientEscrow` (`0xc0710ec8`); no transaction sent |
| Release from a non-owner address | Refused | Reverted `NotOwner` (`0x30cd7471`) |
| Owner pauses programme 1 | Status Paused | Tx `0xf2f145be5b2db686f4704916ed1e387f015ca5ab4ffe74904bab3760d944e4b4`, block 27,530,538. Status 2 (Paused), funded 0.1, paid 0.02, balance 0.08 |

The report reference is `keccak256(abi.encode("SMOKE-0001", keccak256("sehat-smoke-salt-2026-10-20")))`.
The remaining 0.08 BOT can be recovered with `startClosing(1)` followed, 7 days later, by `withdrawUnused(1, owner)`.
