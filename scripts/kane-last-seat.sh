#!/usr/bin/env bash
#
# Kane CLI last-seat journey.
#
# Drives the Collision Canary last-seat scenario with two REAL browsers:
#   1. Create a run (returns two tokenized actor links).
#   2. Launch Alice and Bob as two parallel Kane CLI browser sessions.
#      Each opens its actor link, clicks "Arm claim", waits at the shared
#      barrier, and observes the auto-claim outcome.
#   3. Evaluate the run and print the verdict.
#
# Against production the claim path is atomic, so the healthy result is one
# winner and one correct rejection (invariant satisfied). The controlled
# violation is a local-only fixture and is intentionally disabled in prod.
#
# Requirements: kane-cli (authenticated), curl, python3.
# Usage: bash scripts/kane-last-seat.sh
#   Override target with COLLISION_CANARY_BASE_URL=https://... 

set -euo pipefail

BASE="${COLLISION_CANARY_BASE_URL:-https://collision-canary.vercel.app}"
export KANE_CLI_USER_AGENT="${KANE_CLI_USER_AGENT:-kane-last-seat}"

echo "Creating a run at ${BASE} ..."
RUN_JSON="$(curl -s -X POST "${BASE}/api/v1/runs" \
  -H 'Content-Type: application/json' \
  -d '{"scenarioKey":"last-seat-v1","invariantKey":"capacity-at-most-one-v1"}')"

read -r RUN_ID ALICE_URL BOB_URL < <(python3 - "${RUN_JSON}" <<'PY'
import sys, json
data = json.loads(sys.argv[1])["data"]
urls = {a["actorKey"]: a["url"] for a in data["actors"]}
print(data["runId"], urls["alice"], urls["bob"])
PY
)
echo "Run: ${RUN_ID}"

OBJECTIVE='Go to {{url}} , click the "Arm claim" button, then wait until a final result message appears and store that message as "outcome"'

echo "Launching Alice and Bob as two parallel Kane sessions ..."
kane-cli run "${OBJECTIVE}" --agent --headless --timeout 180 --max-steps 20 \
  --variables "{\"url\":{\"value\":\"${ALICE_URL}\"}}" >/tmp/kane-alice.ndjson 2>/tmp/kane-alice.err &
PID_A=$!
kane-cli run "${OBJECTIVE}" --agent --headless --timeout 180 --max-steps 20 \
  --variables "{\"url\":{\"value\":\"${BOB_URL}\"}}" >/tmp/kane-bob.ndjson 2>/tmp/kane-bob.err &
PID_B=$!

A_RC=0; wait "${PID_A}" || A_RC=$?
B_RC=0; wait "${PID_B}" || B_RC=$?
echo "Kane sessions finished (alice exit ${A_RC}, bob exit ${B_RC})."

for who in alice bob; do
  echo "--- ${who} outcome ---"
  python3 - "/tmp/kane-${who}.ndjson" <<'PY'
import sys, json
final = {}
for line in open(sys.argv[1], encoding="utf-8"):
    line = line.strip()
    if not line:
        continue
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        continue
    if obj.get("type") == "run_end":
        final = (obj.get("final_state") or {})
print(final.get("outcome", "(no outcome captured)"))
PY
done

echo "Evaluating the run ..."
curl -s -X POST "${BASE}/api/v1/runs/${RUN_ID}/evaluate" >/dev/null
PROOF="$(curl -s "${BASE}/api/v1/runs/${RUN_ID}/proof")"
python3 - "${PROOF}" "${BASE}" "${RUN_ID}" <<'PY'
import sys, json
proof = json.loads(sys.argv[1])["data"]
ev = proof.get("evaluation") or {}
print(
    "Verdict:", ev.get("verdict"),
    "| reason:", ev.get("reasonCode"),
    "| winners:", ev.get("successfulClaims"),
    "| seats left:", ev.get("finalRemaining"),
)
print("Proof page:", f"{sys.argv[2]}/runs/{sys.argv[3]}")
PY
