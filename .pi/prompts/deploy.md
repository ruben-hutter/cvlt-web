---
description: "Validate, review and push main to production (cvlt.ch); the Infomaniak panel deploy is manual"
---

You are deploying what is on `main` to production (cvlt.ch). Follow these steps exactly:

Changes reach `main` only through `wtree finish` (feature worktree → fast-forward merge into `main`); `main` is never edited directly. This prompt does not commit or merge anything — it validates, reviews and pushes `main`. The deploy itself is a manual step in the Infomaniak panel (step 6).

## 1. Pre-flight checks
Run lint and typecheck to ensure nothing is broken:
- Lint — only if an ESLint config exists in the repo root (set-up ticket: `plans/tickets/2026-10-20-setup-eslint.md`). Check: `find . -maxdepth 1 \( -name 'eslint.config.*' -o -name '.eslintrc*' \)`
  - Prints a path → run `npx next lint`.
  - Prints nothing → do NOT run `npx next lint` — without a config it opens ESLint's interactive setup prompt instead of linting. Note "no ESLint config — skipped (see the open set-up-ESLint ticket)" and continue.
- Typecheck — always run: `npx tsc --noEmit`

If there are errors, STOP and report them — do not proceed.

## 2. Sanity checks
- Confirm `git branch --show-current` prints `main` (that is the `main` worktree, `/home/ruben/repos/cvlt/cvlt-web/main`). If not, STOP and report it — never switch branches or directories to work around it.
- Run `git status --porcelain`. It must be empty. If it is not, STOP and report what is dirty: `main` is never edited directly, so a dirty `main` worktree means something went wrong upstream.

## 3. What will be deployed
- `git fetch origin`
- Show `git log --oneline origin/main..main` — these are the commits that will be pushed and deployed.
- If the list is empty, report "nothing to deploy" and stop.
- Also check `git log --oneline main..origin/main`. If that is not empty, local `main` is behind (or has diverged from) the remote — STOP and report it. Do not pull, merge or rebase here; the `main` worktree has to be fast-forwarded to `origin/main` first.

## 4. AI code review (review gate)
- `git diff origin/main...HEAD | bash scripts/ai-review.sh`

It reviews exactly the commits from step 3, using the GitHub Copilot API (gpt-4.1) via the `gh` CLI. Exit codes: 0 = PASS, 2 = FAIL, 1 = error. The diff is piped in on purpose: without a TTY the script reads the diff from stdin, so a bare `bash scripts/ai-review.sh` from an agent shell would review an empty diff and pass.

- If it exits **2 (FAIL)**: STOP and report the issues to the user. Do not proceed until the user confirms the issues are acceptable or have been fixed.
- If it exits **1**: report the error (auth/network) and stop.
- If it exits **0 (PASS)**: proceed to the next step.

## 5. Push
- `git push origin main`
- If the push is rejected or fails, report the error and stop.

## 6. Report
- Report what was pushed (the commits from step 3).
- Remind the user that the last step is manual: click **Deploy** in the Infomaniak panel. The panel runs `scripts/deploy-timed.sh` on the host (git pull, migrations, build) and then restarts the app — pushing alone does not deploy.
- Point to `logs/deploy-timing.*.log` and `logs/server.log` on the host to verify the deploy.

IMPORTANT: Never force push. Never use --no-verify. If anything fails, stop and report.
