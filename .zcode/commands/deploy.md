---
description: "Validate, commit, merge to main, deploy to production"
---

You are deploying the current changes to production (cvlt.ch). Follow these steps exactly:

## 1. Pre-flight checks
Run typecheck and tests to ensure nothing is broken:
- `npx tsc --noEmit`
- `npm test`

If there are errors, STOP and report them — do not proceed.

## 2. AI code review
Run the harness-independent review script on the changes to be deployed:

- `bash scripts/ai-review.sh`

It reviews `origin/main...HEAD` automatically (or a diff piped to it), using
the GitHub Copilot API via the `gh` CLI. Exit codes: 0 = PASS, 2 = FAIL,
1 = error.

- If it exits **2 (FAIL)**: STOP and report the issues to the user. Do not proceed until the user confirms the issues are acceptable or have been fixed.
- If it exits **1**: report the error (auth/network) and stop.
- If it exits **0 (PASS)**: proceed to the next step.

## 3. Commit
- Run `git status` and `git diff` to see all changes
- Stage all relevant files (`git add`)
- Write a concise commit message in **English** that describes the changes (imperative mood, e.g. "add contact section" not "added contact section" or "aggiunge sezione contatti")
- If no changes are staged, report that and stop

## 4. Push to dev
- Push to origin dev: `git push origin dev`
- If the push fails, report the error and stop

## 5. Create or update PR
- Check if there's already an open PR from dev to main: `gh pr list --head dev --base main`
- If no PR exists, create one: `gh pr create --base main --head dev --title "deploy: <commit subject>" --body "<summary>"`
- If a PR already exists, it will automatically update with the new commit

## 6. Wait for CI
- Wait for the CI check to pass on the PR: `gh pr checks <pr-number>`
- If CI fails, report the failure and STOP — do not merge

## 7. Merge PR to main
- Once CI passes, merge the PR: `gh pr merge <pr-number> --merge`
- This deploys to production (cvlt.ch)

## 8. Report
- Confirm the merge was successful
- Report what was deployed to production (cvlt.ch)

IMPORTANT: Never force push. Never use --no-verify. If anything fails, stop and report.
