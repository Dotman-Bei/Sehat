#!/usr/bin/env sh
# End-to-end test of the private reports API: an anvil fork of BOT Chain mainnet, a dev server in full live mode
# with a throwaway database, and real wallet signatures. Nothing touches the real network or data.
set -e
cd "$(dirname "$0")/.."

# Stops whatever listens on a port (the dev server's child survives a plain kill on Windows).
free_port() {
  pid=$(netstat -ano 2>/dev/null | grep ":$1 .*LISTEN" | awk '{print $NF}' | head -1)
  [ -n "$pid" ] && { taskkill //F //T //PID "$pid" >/dev/null 2>&1 || kill "$pid" 2>/dev/null; } || true
}
port_busy() { netstat -ano 2>/dev/null | grep -q ":$1 .*LISTEN"; }

FORK_PORT=8551
APP_PORT=3400
RUN=".data/test-$(date +%s)"
mkdir -p "$RUN"

export NEXT_PUBLIC_SEHAT_ESCROW=0xD438c5aF89538Dc8a00ABCFB688c42ebBAA0463D
export NEXT_PUBLIC_SEHAT_ESCROW_BLOCK=27949448
export NEXT_PUBLIC_SEHAT_REPORTS=live
export NEXT_PUBLIC_SEHAT_RPC=http://127.0.0.1:$FORK_PORT
export SEHAT_DB_FILE="$RUN/sehat.db"
export SEHAT_SESSION_SECRET=test-secret-test-secret-test-secret-0123
ADMIN_KEY=$(cast wallet new --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log((Array.isArray(j)?j[0]:j).private_key)})")
export ADMIN_KEY
export SEHAT_ADMINS=$(cast wallet address "$ADMIN_KEY" | tr 'A-F' 'a-f')
export APP=http://localhost:$APP_PORT
export SERVER_LOG="$RUN/server.log"

for p in $APP_PORT $FORK_PORT; do port_busy $p && { echo "port $p is in use; stop it first"; exit 1; }; done

anvil --silent --port $FORK_PORT --fork-url https://rpc.botchain.ai &
ANVIL=$!
NEXT_DIST_DIR=.next-test npx next dev -p $APP_PORT > "$SERVER_LOG" 2>&1 &
NEXT=$!
cleanup() { kill $ANVIL $NEXT 2>/dev/null || true; free_port $APP_PORT; free_port $FORK_PORT; }
trap cleanup EXIT

for i in $(seq 1 30); do cast chain-id --rpc-url $NEXT_PUBLIC_SEHAT_RPC >/dev/null 2>&1 && break; sleep 1; done
for i in $(seq 1 90); do [ "$(curl -s -o /dev/null -w '%{http_code}' $APP/api/auth/me)" = 200 ] && break; sleep 2; done
npx tsx scripts/reports-api.test.mts
