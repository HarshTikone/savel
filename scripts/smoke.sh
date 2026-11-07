#!/usr/bin/env bash
# End-to-end smoke test. Assumes the api (and the simulator behind it) is already running.
#   BASE=https://savel.example bash scripts/smoke.sh
set -euo pipefail
BASE="${BASE:-http://localhost:8000}"
PY="$(command -v python3 || command -v python)"
rows() { curl -sf "$BASE/api/health" | "$PY" -c 'import sys,json; print(json.load(sys.stdin)["rows_ingested"])'; }

echo "smoke: reset at $BASE"
curl -sf -X POST "$BASE/api/sim/reset" >/dev/null || { echo "FAIL: reset"; exit 1; }
r0="$(rows)"
for i in $(seq 1 20); do
  sleep 2
  hit="$(curl -sf "$BASE/api/homes" | "$PY" -c '
import sys, json
hs = [h for h in json.load(sys.stdin) if h["block"] == "B" and h["status"] in ("warning", "critical")]
print(",".join(h["id"] + ":" + h["status"] for h in hs))')" || hit=""
  if [ -n "$hit" ]; then
    r1="$(rows)"
    if [ "$r1" -gt "$r0" ]; then
      echo "PASS after $((i * 2))s: Block B at risk [$hit]; rows_ingested $r0 -> $r1"
      exit 0
    fi
  fi
done
echo "FAIL: no Block B home reached warning/critical within 40 s (rows_ingested $r0 -> $(rows))"
exit 1
