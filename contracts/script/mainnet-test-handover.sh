#!/usr/bin/env bash
# Team test: W1 tops up W3,W4,W5,W7,W8,W9, then programme A is handed W3→W4→W5→W7→W8→W9.
set -euo pipefail
cd "/c/Users/bamig/Documents/VIBE CODE/Sehat/contracts"
R=${RPC:-https://rpc.botchain.ai}; CA=0xD438c5aF89538Dc8a00ABCFB688c42ebBAA0463D
key() { grep "^W$1_KEY=" .env.testwallets | cut -d= -f2 | tr -d '\r'; }
adr() { grep "^W$1_ADDR=" .env.testwallets | cut -d= -f2 | tr -d '\r'; }
tx() { cast send "$@" --rpc-url $R --legacy --gas-price 20gwei 2>&1 | awk '/^status/{s=$2} /^transactionHash/{h=$2} END{print s, h; if (s!=1) exit 1}'; }
declare -A TARGET=([3]=1100000000000000 [4]=1900000000000000 [5]=1900000000000000 [7]=1900000000000000 [8]=1900000000000000 [9]=800000000000000)
echo "W1 balance $(cast balance $(adr 1) --rpc-url $R --ether)"
for w in 3 4 5 7 8 9; do
  have=$(cast balance $(adr $w) --rpc-url $R)
  amt=$(python -c "print(max(0, ${TARGET[$w]} - $have))")
  [ "$amt" = 0 ] && continue
  echo -n "0. W1 -> W$w $(cast from-wei $amt) BOT: "; tx $(adr $w) --value $amt --gas-limit 21000 --private-key $(key 1)
done
chain=(3 4 5 7 8 9); n=1
for i in 0 1 2 3 4; do
  a=${chain[$i]}; b=${chain[$((i+1))]}
  echo -n "$n. W$a offer A to W$b: "; tx $CA "transferProgrammeOwnership(uint256,address)" 1 $(adr $b) --private-key $(key $a); n=$((n+1))
  echo -n "$n. W$b accept A: "; tx $CA "acceptProgrammeOwnership(uint256)" 1 --private-key $(key $b); n=$((n+1))
done
