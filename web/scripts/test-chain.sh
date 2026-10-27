#!/usr/bin/env sh
# Tests the app's chain data layer:
#   1. live reads from the BOT Chain mainnet deployment,
#   2. every write path against a local anvil fork of BOT Chain mainnet (nothing is sent to the real network).
set -e
cd "$(dirname "$0")/.."

export NEXT_PUBLIC_SEHAT_ESCROW=0xD438c5aF89538Dc8a00ABCFB688c42ebBAA0463D
export NEXT_PUBLIC_SEHAT_ESCROW_BLOCK=27949448
# Programme 2 is a paused test programme from the mainnet team test; the fork impersonates its owner.
export PROGRAMME=2
export OWNER=0x6bf74C78F14804C16384f42060edc480403e3881

echo "== live read (BOT Chain mainnet)"
npx tsx scripts/chain-live-read.test.mts

echo "== writes (anvil fork of BOT Chain mainnet)"
PORT=8549
anvil --silent --port $PORT --fork-url https://rpc.botchain.ai &
ANVIL=$!
trap 'kill $ANVIL 2>/dev/null || true' EXIT
for i in $(seq 1 30); do cast chain-id --rpc-url http://127.0.0.1:$PORT >/dev/null 2>&1 && break; sleep 1; done
NEXT_PUBLIC_SEHAT_RPC=http://127.0.0.1:$PORT npx tsx scripts/chain-fork-write.test.mts
