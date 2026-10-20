#!/usr/bin/env sh
# Tests the app's chain data layer:
#   1. live reads from the Bohr testnet deployment,
#   2. every write path against a local anvil fork of Bohr (nothing is sent to the real network).
set -e
cd "$(dirname "$0")/.."

export NEXT_PUBLIC_SEHAT_NETWORK=testnet
export NEXT_PUBLIC_SEHAT_ESCROW=0xbC555De32fb45a8FF3297cbbc1a6F50F7674Bb54
export NEXT_PUBLIC_SEHAT_ESCROW_BLOCK=27529541
export OWNER=0x1727eF2a5622B8559Af818A942dBFd59493e175E

echo "== live read (Bohr testnet)"
npx tsx scripts/chain-live-read.test.mts

echo "== writes (anvil fork of Bohr)"
PORT=8549
anvil --silent --port $PORT --fork-url https://rpc.bohr.life &
ANVIL=$!
trap 'kill $ANVIL 2>/dev/null || true' EXIT
for i in $(seq 1 30); do cast chain-id --rpc-url http://127.0.0.1:$PORT >/dev/null 2>&1 && break; sleep 1; done
NEXT_PUBLIC_SEHAT_RPC=http://127.0.0.1:$PORT npx tsx scripts/chain-fork-write.test.mts
