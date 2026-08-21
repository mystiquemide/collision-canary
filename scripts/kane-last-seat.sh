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
# Requirements: kane-cli (authenticated), Google Chrome, curl, python3.
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

CHROME_A_PID=""
CHROME_B_PID=""
cleanup() {
  for pid in "${CHROME_A_PID}" "${CHROME_B_PID}"; do
    if [[ -n "${pid}" ]] && kill -0 -- "-${pid}" 2>/dev/null; then
      kill -- "-${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
    fi
  done
  for _ in {1..10}; do
    rm -rf -- "${WORK_DIR}" 2>/dev/null || true
    [[ ! -e "${WORK_DIR}" ]] && return 0
    sleep 0.1
  done
  printf '%s\n' "Kane temporary directory could not be removed: ${WORK_DIR}" >&2
  return 0
}
trap cleanup EXIT

mkdir -p "${WORK_DIR}/alice-profile" "${WORK_DIR}/bob-profile"

wait_for_cdp() {
  local profile="$1"
  local pid="$2"
  local label="$3"
  local port_file="${profile}/DevToolsActivePort"

  for _ in {1..50}; do
    if [[ -s "${port_file}" ]]; then
      printf 'http://127.0.0.1:%s\n' "$(sed -n '1p' "${port_file}")"
      return 0
    fi
    if ! kill -0 "${pid}" 2>/dev/null; then
      printf '%s\n' "${label} Chrome exited before CDP was ready." >&2
      return 1
    fi
    sleep 0.2
  done

  printf '%s\n' "${label} Chrome did not expose CDP in time." >&2
  return 1
}

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

ALICE_OBJECTIVE='Go to {{alice_url}}, wait 12 seconds for the paired booking to finish, and verify through the page text that the final result says either "The actor claimed the final seat" or "The final seat was already claimed". Fail if the page shows a timeout, missing token, missing peer, or generic error.'
BOB_OBJECTIVE='Go to {{bob_url}}, wait 12 seconds for the paired booking to finish, and verify through the page text that the final result says either "The actor claimed the final seat" or "The final seat was already claimed". Fail if the page shows a timeout, missing token, missing peer, or generic error.'

setsid google-chrome --headless=new --no-sandbox --disable-dev-shm-usage \
  --remote-debugging-address=127.0.0.1 --remote-debugging-port=0 \
  --user-data-dir="${WORK_DIR}/alice-profile" about:blank \
  >"${WORK_DIR}/alice-chrome.log" 2>&1 &
CHROME_A_PID=$!
setsid google-chrome --headless=new --no-sandbox --disable-dev-shm-usage \
  --remote-debugging-address=127.0.0.1 --remote-debugging-port=0 \
  --user-data-dir="${WORK_DIR}/bob-profile" about:blank \
  >"${WORK_DIR}/bob-chrome.log" 2>&1 &
CHROME_B_PID=$!

ALICE_CDP="$(wait_for_cdp "${WORK_DIR}/alice-profile" "${CHROME_A_PID}" "Alice")"
BOB_CDP="$(wait_for_cdp "${WORK_DIR}/bob-profile" "${CHROME_B_PID}" "Bob")"

echo "Launching Alice and Bob as two parallel Kane sessions ..."
kane-cli run "${ALICE_OBJECTIVE}" --agent --headless --timeout 180 --max-steps 20 \
  --mode action --assertion-mode dom \
  --cdp-endpoint "${ALICE_CDP}" \
  --variables-file "${WORK_DIR}/alice-variables.json" \
  >"${WORK_DIR}/alice.ndjson" 2>"${WORK_DIR}/alice.err" &
PID_A=$!
kane-cli run "${BOB_OBJECTIVE}" --agent --headless --timeout 180 --max-steps 20 \
  --mode action --assertion-mode dom \
  --cdp-endpoint "${BOB_CDP}" \
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
failed = False
for name, path, exit_code in actors:
    final = run_end(path)
    status = str((final or {}).get("status") or "missing")
    reason = str((final or {}).get("reason") or "No run_end event was emitted.")
    print(f"{name}: {status}")
    if exit_code != 0 or status != "passed":
        print(f"{name} reason: {reason}", file=sys.stderr)
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
actor_statuses = sorted(actor.get("status") for actor in proof.get("actors", []))
outcome_codes = sorted(actor.get("outcomeCode") for actor in proof.get("actors", []))
attempt_results = sorted(attempt.get("result") for attempt in proof.get("attempts", []))
if (
    proof.get("run", {}).get("status") != "verified"
    or ev.get("verdict") != "satisfied"
    or ev.get("reasonCode") != "capacity_invariant_satisfied"
    or ev.get("successfulClaims") != 1
    or ev.get("persistedClaims") != 1
    or ev.get("finalRemaining") != 0
    or actor_statuses != ["rejected", "succeeded"]
    or outcome_codes != ["seat_claimed", "seat_unavailable"]
    or attempt_results != ["rejected", "succeeded"]
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
