#!/usr/bin/env bash
#
# AI code review via the GitHub Copilot API — harness independent.
#
# Works from any agent (opencode, ZCode, Claude Code, ...) or plain shell:
# the only requirement is the `gh` CLI authenticated with the GitHub account
# that holds the Copilot plan. Default model is gpt-4.1 (included in every
# Copilot plan, ~1M token context). Premium models (Claude/GPT-5.x) are NOT
# available through this API path unless the plan allows it — see
# https://github.com/settings/copilot for your entitlements.
#
# Usage:
#   scripts/ai-review.sh                 # reviews current branch vs origin/main
#   git diff origin/main | scripts/ai-review.sh   # reviews a diff from stdin
#   scripts/ai-review.sh my-changes.patch # reviews a diff file
#
# Environment:
#   AI_REVIEW_MODEL     model id (default: gpt-4.1)
#   AI_REVIEW_BASE      base ref for the auto diff (default: origin/main)
#   AI_REVIEW_MAX_CHARS hard cap on diff size (default: 900000)
#
# Exit codes: 0 = PASS, 2 = FAIL (review blocked), 1 = error.
#
set -euo pipefail

model="${AI_REVIEW_MODEL:-gpt-4.1}"
base="${AI_REVIEW_BASE:-origin/main}"
max_chars="${AI_REVIEW_MAX_CHARS:-900000}"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not found — install it and run 'gh auth login'." >&2
  exit 1
fi

diff_src=""
tmp_file=""
cleanup() {
  if [ -n "$tmp_file" ]; then rm -f "$tmp_file"; fi
}
trap cleanup EXIT

if [ $# -ge 1 ] && [ "$1" != "-" ]; then
  diff_src="$1" # caller-managed file, never deleted by this script
elif [ ! -t 0 ]; then
  tmp_file="$(mktemp)"; cat > "$tmp_file"; diff_src="$tmp_file"
else
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "error: not inside a git repository and no diff given on stdin." >&2
    exit 1
  fi
  tmp_file="$(mktemp)"
  git diff "$base...HEAD" > "$tmp_file"
  diff_src="$tmp_file"
fi

if [ ! -s "$diff_src" ]; then
  echo "Nothing to review (empty diff)."
  exit 0
fi

token="$(gh auth token)"
export AI_REVIEW_TOKEN="$token" AI_REVIEW_MODEL="$model" AI_REVIEW_MAX_CHARS="$max_chars"

python3 - "$diff_src" <<'PY'
import json
import os
import re
import sys
import urllib.error
import urllib.request

diff_path = sys.argv[1]
model = os.environ["AI_REVIEW_MODEL"]
max_chars = int(os.environ["AI_REVIEW_MAX_CHARS"])
token = os.environ["AI_REVIEW_TOKEN"]

with open(diff_path, encoding="utf-8", errors="replace") as fh:
    diff = fh.read()
truncated = ""
if len(diff) > max_chars:
    truncated = f"\n\n[NOTE: diff truncated to {max_chars} characters out of {len(diff)}.]"
    diff = diff[:max_chars]

system_prompt = """You are a senior code reviewer for a Next.js + Payload CMS project (cvlt.ch).
Review the code diff provided by the user and return a structured verdict.

## Review checklist

### 1. Security
- XSS vulnerabilities, unescaped user input
- SQL injection or unsafe DB queries
- Exposed secrets, tokens, or credentials in code
- Missing auth checks or authorization bypasses
- Unsafe file uploads or path traversal

### 2. Code style & best practices
- Inconsistent naming conventions
- Missing or incorrect TypeScript types
- Unused imports, variables, or dead code
- Functions that are too long or do too much
- Missing error handling (try/catch, null checks)

### 3. Duplicate code
- Copy-pasted logic that should be shared
- Similar components that could be abstracted
- Repeated patterns across files that belong in a utility

### 4. Performance
- Unnecessary re-renders or missing memoization
- Missing lazy loading for heavy components
- N+1 queries or missing pagination
- Large bundle imports (import entire library vs specific)

### 5. Correctness
- Off-by-one errors, wrong conditions
- Race conditions or async/await mistakes
- Missing edge cases (empty arrays, null values, undefined)
- Renames or signature changes applied to some call sites but not others
  (if the diff renames a field/identifier, every visible usage must be updated)

### Verdict rules
- You only see the diff: judge exactly what is visible in it.
- If a change is only correct under an assumption that the diff itself does not
  show (e.g. a property existing on a type, a caller being updated elsewhere),
  treat it as an issue and FAIL — list the assumption explicitly.
- Pure deletions of data/configuration with no logic change and consistent
  references are normally a PASS.

## Output format

Return your review in this exact format:

## Review: [PASS or FAIL]

### Summary
[1-2 sentence overall assessment]

### Issues found
[If FAIL, list specific issues with file:line references and clear explanations]

### Suggestions (non-blocking)
[Optional improvements that don't block deployment]

Be strict but pragmatic. Block deployment only for genuine security issues, bugs, or
significant code quality problems. Style preferences and minor improvements should be
suggestions, not blockers."""

payload = json.dumps(
    {
        "model": model,
        "temperature": 0,
        "max_tokens": 6000,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": "Review this diff:\n\n```diff\n" + diff + "\n```" + truncated,
            },
        ],
    }
).encode()

req = urllib.request.Request(
    "https://api.githubcopilot.com/chat/completions",
    method="POST",
    data=payload,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Copilot-Integration-Id": "vscode-chat",
        "Editor-Version": "vscode/1.100.0",
        "User-Agent": "cvlt-ai-review/1.0",
    },
)

print(f"[ai-review] model={model} diff_chars={len(diff)}{' (truncated)' if truncated else ''}", file=sys.stderr)
try:
    with urllib.request.urlopen(req, timeout=180) as res:
        body = json.loads(res.read())
except urllib.error.HTTPError as err:
    detail = err.read().decode("utf-8", "replace")[:500]
    print(f"[ai-review] API error {err.code}: {detail}", file=sys.stderr)
    sys.exit(1)
except Exception as err:  # network/timeout
    print(f"[ai-review] request failed: {err}", file=sys.stderr)
    sys.exit(1)

if "error" in body:
    print(f"[ai-review] API error: {body['error']}", file=sys.stderr)
    sys.exit(1)

content = body["choices"][0]["message"]["content"]
print(content)

verdict = re.search(r"review[:\s]*\**\s*(pass|fail)\b", content, re.IGNORECASE)
sys.exit(2 if (verdict and verdict.group(1).lower() == "fail") else 0)
PY

# Explicitly propagate the reviewer's exit code (0=PASS, 2=FAIL, 1=error);
# the EXIT trap must not mask it.
review_status=$?
exit "$review_status"
