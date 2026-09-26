#!/usr/bin/env bash
set -euo pipefail

# Timed deploy helper: pulls latest code, then runs timed build.
# Usage: bash scripts/deploy-timed.sh

mkdir -p logs
timestamp="$(date +%Y_%m_%d_%H%M%S)"
log_file="logs/deploy-timing.${timestamp}.log"

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
  start="$(date +%s)"
  "$@"
  end="$(date +%s)"
  elapsed="$((end - start))"

  step_names+=("${name}")
  step_secs+=("${elapsed}")
  echo "--- ${name} finished in ${elapsed}s ---"
}

echo "=== CVLT timed deploy started at $(date) ===" | tee "${log_file}"

{
  run_step "git pull" git pull origin main
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
    total="$((total + step_secs[$i]))"
  done
  echo "Total: ${total}s"
  echo ""
  echo "Log file: ${log_file}"
} 2>&1 | tee -a "${log_file}"
