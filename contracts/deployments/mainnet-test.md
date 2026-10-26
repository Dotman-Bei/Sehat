# Mainnet contract test (team testing, not usage)

Team test of `0xD438c5aF89538Dc8a00ABCFB688c42ebBAA0463D` on BOT Chain mainnet (chain 677), 2026-10-26.
Every wallet below is a throwaway test wallet controlled by the Sehat team. None of this is user
activity, and programmes #1 and #2 are labelled in their metadata as tests, not real bounties. All
transactions use the 20 gwei gas floor. Explorer: `https://scan.botchain.ai/tx/<hash>`.

Result: 10 sending wallets (the deployer and W1–W9), 23 transactions to the contract.

## Round 1: `web/scripts/mainnet-test-plan.mts` (10 transactions)

Register, fund, release, pause and ownership handover. Hashes and gas in `mainnet-test-mainnet.json`.
The script also simulates three refusals: a report paid twice (`AlreadyPaid`), the old owner paying
after handover (`NotOwner`) and a payout above the escrow (`InsufficientEscrow`).

## Round 2: handover A from W6 to W3 (2 transactions)

| Action | Tx |
|---|---|
| W6 offers A to W3 | `0x93d92fc2571d6e1775f2bd9779482c108356c1cca8bd898c18cf9cd4339cf537` |
| W3 accepts A | `0x6a376b2a9ee62dc75705f986f57bd8b4e4b6351673decd8a87c0eff19b5901e0` |

## Round 3: `contracts/script/mainnet-test-handover.sh` (10 transactions)

W1 first topped up W3, W4, W5, W7, W8 and W9 with gas (6 plain transfers, not to the contract).

| Action | Tx |
|---|---|
| W3 offers A to W4 | `0xac30cd74ab392d72d032de15b649208c5f5cef46d84d57e6964473b526510e3c` |
| W4 accepts A | `0xf9c32207cbb004737022f7c12c5683c9b78a91281b17ba1b1748e43b51fe5a75` |
| W4 offers A to W5 | `0x274b6baef5d405677edd68b05650bf0144935162854286c90df6c918926317ae` |
| W5 accepts A | `0xf5c47c3a8674c4a847b3fb72e1f0b66c8018c9292fbcb6f025eff403a14f2530` |
| W5 offers A to W7 | `0xd03a86c2e0756361cf629b888272615932b94b1007fcdcd4480c01680f91852e` |
| W7 accepts A | `0xcca6700f014d598ee49440273a563f348855a424d34942179e4b678758934301` |
| W7 offers A to W8 | `0x3b2a53ec9f6ce8d5dcfd4af7b04695a76fb879253dd4eaea2854a23e6b7ff95a` |
| W8 accepts A | `0x688852aa59c7cdda25515e7d749bba01f432c3ad789714eb364d6d3e41dceb55` |
| W8 offers A to W9 | `0x8824074aa34210b8704e175fdbaf7a28ffea5fa5efac6738bce5e745bdd176f9` |
| W9 accepts A | `0xe5e028ea868408e84710a9eb5ed1a9e0386798113a374ead9213a1dcfd423f1b` |

Test wallet keys live in the git-ignored `contracts/.env.testwallets`.
