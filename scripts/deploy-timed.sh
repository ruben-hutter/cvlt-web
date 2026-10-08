#!/usr/bin/env bash
set -euo pipefail

# Timed deploy helper: pulls latest code, applies DB migrations, runs timed build.
# Usage: bash scripts/deploy-timed.sh
#
# The Infomaniak panel launches the checkout's copy of this script as it exists
# when the deploy is triggered. If the git pull below updates this very file,
# the already-running copy would keep executing the old logic (this is exactly
# how the alerted_at migration got skipped on 2026-09-28). To make new script
# steps effective on the same deploy, we re-exec the freshly pulled version
# exactly once; the resumed run skips the pull and goes straight to migrate +
# build.

mkdir -p logs

log_file="${DEPLOY_LOG_FILE:-logs/deploy-timing.$(date +%Y_%m_%d_%H%M%S).log}"

step_names=()
step_secs=()

run_step() {
  local name="$1"
  shift

  echo ""
  echo "=== ${name} ==="
  local start
  local end
  local elapsed
  local status
  start="$(date +%s)"
  # Explicit capture: inside an `if !` condition set -e is suspended, so a
  # plain `"$@"` would let the function return the echo's status instead.
  if "$@"; then
    status=0
  else
    status=$?
  fi
  end="$(date +%s)"
  elapsed="$((end - start))"

  step_names+=("${name}")
  step_secs+=("${elapsed}")
  echo "--- ${name} finished in ${elapsed}s ---"
  return "${status}"
}

if [ "${DEPLOY_RESUMED:-}" = "1" ]; then
  echo "=== CVLT timed deploy resumed at $(date) with the freshly pulled deploy-timed.sh ===" | tee -a "${log_file}"
else
  echo "=== CVLT timed deploy started at $(date) ===" | tee "${log_file}"
  if ! run_step "git pull" git pull origin main 2>&1 | tee -a "${log_file}"; then
    echo "git pull failed — aborting deploy" | tee -a "${log_file}"
    exit 1
  fi
  # Hand control to the just-pulled version of this script so new steps
  # (e.g. a newly added db migrate step) are never skipped by a deploy that
  # itself ships script changes.
  DEPLOY_RESUMED=1 DEPLOY_LOG_FILE="${log_file}" exec bash "$(readlink -f "$0")"
fi

{
  # Apply pending DB migrations BEFORE building/restarting. The `echo y`
  # answers Payload's one-time prompt about the historic drizzle-push batch
  # ("dev") still recorded in payload_migrations; the actual pending
  # migrations are explicit committed files and safe to apply.
  run_step "db migrate" sh -c 'echo y | npm run db:migrate'
  run_step "npm run build:timed" npm run build:timed

  echo ""
  echo "=== Timing summary ==="
  total=0
  for i in "${!step_names[@]}"; do
    echo "${step_names[$i]}: ${step_secs[$i]}s"
    total=$((total + step_secs[$i]))
  done
  echo "Total: ${total}s"
  echo ""
  echo "Log file: ${log_file}"
} 2>&1 | tee -a "${log_file}"
