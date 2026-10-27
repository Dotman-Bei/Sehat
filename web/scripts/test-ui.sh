#!/usr/bin/env sh
# Browser end-to-end test of the full live flow (submit → triage → reply → reward → release → paid →
# moderation) on an anvil fork of BOT Chain mainnet with a throwaway database. Needs Foundry and Chrome/Edge.
set -e
cd "$(dirname "$0")/.."

# Stops whatever listens on a port (the dev server's child survives a plain kill on Windows).
free_port() {
  pid=$(netstat -ano 2>/dev/null | grep ":$1 .*LISTEN" | awk '{print $NF}' | head -1)
  [ -n "$pid" ] && { taskkill //F //T //PID "$pid" >/dev/null 2>&1 || kill "$pid" 2>/dev/null; } || true
}
port_busy() { netstat -ano 2>/dev/null | grep -q ":$1 .*LISTEN"; }

FORK_PORT=8552
APP_PORT=3500
RUN=".data/ui-$(date +%s)"
mkdir -p "$RUN"

export NEXT_PUBLIC_SEHAT_ESCROW=0xD438c5aF89538Dc8a00ABCFB688c42ebBAA0463D
export NEXT_PUBLIC_SEHAT_ESCROW_BLOCK=27949448
export NEXT_PUBLIC_SEHAT_REPORTS=live
export NEXT_PUBLIC_SEHAT_RPC=http://127.0.0.1:$FORK_PORT
export SEHAT_DB_FILE="$RUN/sehat.db"
export SEHAT_SESSION_SECRET=ui-test-secret-ui-test-secret-0123456789
export APP=http://localhost:$APP_PORT
export OUT="${OUT:-$RUN}"

for p in $APP_PORT $FORK_PORT; do port_busy $p && { echo "port $p is in use; stop it first"; exit 1; }; done

anvil --silent --port $FORK_PORT --fork-url https://rpc.botchain.ai &
ANVIL=$!
for i in $(seq 1 30); do cast chain-id --rpc-url $NEXT_PUBLIC_SEHAT_RPC >/dev/null 2>&1 && break; sleep 1; done
ACCOUNTS=$(cast rpc eth_accounts --rpc-url $NEXT_PUBLIC_SEHAT_RPC)
export ACCOUNTS
export SEHAT_ADMINS=$(echo "$ACCOUNTS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[2].toLowerCase()))")

NEXT_DIST_DIR=.next-ui npx next dev -p $APP_PORT > "$RUN/server.log" 2>&1 &
NEXT=$!
cleanup() { kill $ANVIL $NEXT 2>/dev/null || true; free_port $APP_PORT; free_port $FORK_PORT; }
trap cleanup EXIT
for i in $(seq 1 90); do [ "$(curl -s -o /dev/null -w '%{http_code}' $APP/api/auth/me)" = 200 ] && break; sleep 2; done

npx tsx scripts/ui-e2e.mjs
