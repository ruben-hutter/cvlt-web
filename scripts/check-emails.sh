#!/usr/bin/env bash
# Verifies email obfuscation on a running CVLT instance (dev or prod).
#
# Usage: bash scripts/check-emails.sh [base_url]
# Default base URL: http://localhost:3100
#
# Checks:
#   1. No plain email address in the delivered HTML of the public pages
#   2. No mailto: link in the delivered HTML
#   3. Lists the addresses recoverable from the base64 payloads in the
#      JS chunks, so they can be eyeballed against the source of truth
#      (the pilot list / club address) — these must match what a visitor
#      gets after hydration.
set -u

BASE="${1:-http://localhost:3100}"
EMAIL_RE='[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
PAGES=(/ /contatto /adesione /biposto)

fail=0

echo "Checking $BASE"
echo
echo "1) Plain email addresses in delivered HTML (expect: none)"
for path in "${PAGES[@]}"; do
  hits=$(curl -s "$BASE$path" | grep -oE "$EMAIL_RE" | sort -u)
  if [ -n "$hits" ]; then
    echo "   FAIL $path"
    echo "$hits" | sed 's/^/     /'
    fail=1
  else
    echo "   ok   $path"
  fi
done

echo
echo "2) mailto: links in delivered HTML (expect: none)"
for path in "${PAGES[@]}"; do
  count=$(curl -s "$BASE$path" | grep -o 'mailto:' | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "   FAIL $path: $count mailto: link(s) in raw HTML"
    fail=1
  else
    echo "   ok   $path"
  fi
done

echo
echo "3) Addresses recoverable from base64 payloads (must match the pilot list)"
found=$(
  curl -s "$BASE/biposto" | grep -oE '/_next/static/chunks/[^"]+\.js' | sort -u |
    while read -r chunk; do curl -s "$BASE$chunk"; echo; done |
    grep -oE '\b[A-Za-z0-9+/]{12,64}={0,2}\b' | sort -u |
    while read -r token; do
      decoded=$(printf '%s' "$token" | base64 -d 2>/dev/null | tr -d '\0' || true)
      printf '%s\n' "$decoded" | grep -qE "^${EMAIL_RE}$" && printf '%s\n' "$decoded"
    done | sort -u
)
if [ -n "$found" ]; then
  echo "$found" | sed 's/^/   /'
  echo "   -> compare against the encoded list in src/app/(frontend)/biposto/BipostoContent.tsx"
else
  echo "   WARN: no decodable address found — check the chunks are being served"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "RESULT: PASS (no harvestable addresses in delivered HTML)"
else
  echo "RESULT: FAIL — plain addresses or mailto links found in delivered HTML"
fi
exit "$fail"
