#!/usr/bin/env sh
# Regenerates web/lib/escrow-abi.ts from the compiled contract.
set -e
cd "$(dirname "$0")/.."
ABI=$(forge inspect SehatEscrow abi --json)
{ echo "// Generated from contracts/src/SehatEscrow.sol by contracts/script/export-abi.sh. Do not edit."; echo "export const ESCROW_ABI = $ABI as const;"; } > ../web/lib/escrow-abi.ts
echo "wrote web/lib/escrow-abi.ts"
