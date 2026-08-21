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
umask 077

WORK_DIR="$(mktemp -d /tmp/collision-canary-kane.XXXXXX)"
case "${WORK_DIR}" in
  /tmp/collision-canary-kane.*) ;;
  *) echo "Unexpected Kane work directory: ${WORK_DIR}" >&2; exit 1 ;;
esac
trap 'rm -rf -- "${WORK_DIR}"' EXIT

mkdir -p "${WORK_DIR}/alice-profile" "${WORK_DIR}/bob-profile"

echo "Creating a run at ${BASE} ..."
RUN_JSON="$(curl --fail-with-body -sS -X POST "${BASE}/api/v1/runs" \
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

python3 - "${ALICE_URL}" "${WORK_DIR}/alice-variables.json" <<'PY'
import json, sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
parts = urlsplit(sys.argv[1])
query = parse_qsl(parts.query, keep_blank_values=True)
query.append(("auto", "1"))
url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
with open(sys.argv[2], "w", encoding="utf-8") as handle:
    json.dump({"alice_url": {"value": url, "type": "text", "secret": True}}, handle)
PY
python3 - "${BOB_URL}" "${WORK_DIR}/bob-variables.json" <<'PY'
import json, sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
parts = urlsplit(sys.argv[1])
query = parse_qsl(parts.query, keep_blank_values=True)
query.append(("auto", "1"))
url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
with open(sys.argv[2], "w", encoding="utf-8") as handle:
    json.dump({"bob_url": {"value": url, "type": "text", "secret": True}}, handle)
PY

ALICE_OBJECTIVE='Go to {{alice_url}} and wait for the final booking result. Store the full result message as "outcome". The only acceptable final results are that this actor claimed the final seat or that the final seat was already claimed. Treat a timeout, missing peer, infrastructure message, or generic error as a failed objective.'
BOB_OBJECTIVE='Go to {{bob_url}} and wait for the final booking result. Store the full result message as "outcome". The only acceptable final results are that this actor claimed the final seat or that the final seat was already claimed. Treat a timeout, missing peer, infrastructure message, or generic error as a failed objective.'

echo "Launching Alice and Bob as two parallel Kane sessions ..."
kane-cli run "${ALICE_OBJECTIVE}" --agent --headless --timeout 180 --max-steps 20 \
  --mode action --assertion-mode dom --final-validation on \
  --chrome-profile "${WORK_DIR}/alice-profile" \
  --variables-file "${WORK_DIR}/alice-variables.json" \
  >"${WORK_DIR}/alice.ndjson" 2>"${WORK_DIR}/alice.err" &
PID_A=$!
kane-cli run "${BOB_OBJECTIVE}" --agent --headless --timeout 180 --max-steps 20 \
  --mode action --assertion-mode dom --final-validation on \
  --chrome-profile "${WORK_DIR}/bob-profile" \
  --variables-file "${WORK_DIR}/bob-variables.json" \
  >"${WORK_DIR}/bob.ndjson" 2>"${WORK_DIR}/bob.err" &
PID_B=$!

A_RC=0; wait "${PID_A}" || A_RC=$?
B_RC=0; wait "${PID_B}" || B_RC=$?
echo "Kane sessions finished (alice exit ${A_RC}, bob exit ${B_RC})."

if ! python3 - \
  "${WORK_DIR}/alice.ndjson" "${A_RC}" \
  "${WORK_DIR}/bob.ndjson" "${B_RC}" <<'PY'
import sys, json
def run_end(path):
    final = None
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("type") == "run_end":
                final = obj
    return final

actors = [
    ("Alice", sys.argv[1], int(sys.argv[2])),
    ("Bob", sys.argv[3], int(sys.argv[4])),
]
outcomes = []
failed = False
for name, path, exit_code in actors:
    final = run_end(path)
    status = str((final or {}).get("status") or "missing")
    state = (final or {}).get("final_state") or {}
    outcome = str(state.get("outcome") or "")
    reason = str((final or {}).get("reason") or "No run_end event was emitted.")
    print(f"{name}: {status} | {outcome or 'no outcome'}")
    if exit_code != 0 or status != "passed":
        print(f"{name} reason: {reason}", file=sys.stderr)
        failed = True
    outcomes.append(outcome)

winner_count = sum("claimed the final seat" in outcome for outcome in outcomes)
rejection_count = sum("already claimed" in outcome for outcome in outcomes)
if winner_count != 1 or rejection_count != 1:
    print("Expected one winner and one rejection from Kane.", file=sys.stderr)
    failed = True

if failed:
    raise SystemExit(1)
PY
then
  printf '%s\n' "Kane did not complete both actor journeys." >&2
  printf '%s\n' "Proof page: ${BASE}/runs/${RUN_ID}" >&2
  exit 1
fi

echo "Evaluating the run ..."
curl --fail-with-body -sS -X POST "${BASE}/api/v1/runs/${RUN_ID}/evaluate" >/dev/null
PROOF="$(curl --fail-with-body -sS "${BASE}/api/v1/runs/${RUN_ID}/proof")"
python3 - "${PROOF}" "${BASE}" "${RUN_ID}" <<'PY'
import sys, json
proof = json.loads(sys.argv[1])["data"]
ev = proof.get("evaluation") or {}
if (
    proof.get("run", {}).get("status") != "verified"
    or ev.get("verdict") != "satisfied"
    or ev.get("reasonCode") != "capacity_invariant_satisfied"
    or ev.get("successfulClaims") != 1
    or ev.get("persistedClaims") != 1
    or ev.get("finalRemaining") != 0
):
    raise SystemExit("Persisted proof did not satisfy the last-seat invariant.")
print(
    "Verdict:", ev.get("verdict"),
    "| reason:", ev.get("reasonCode"),
    "| winners:", ev.get("successfulClaims"),
    "| seats left:", ev.get("finalRemaining"),
)
print("Proof page:", f"{sys.argv[2]}/runs/{sys.argv[3]}")
PY
