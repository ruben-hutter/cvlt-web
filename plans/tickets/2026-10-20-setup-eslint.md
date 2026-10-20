# Ticket: Set up ESLint (replace deprecated `next lint`)

**Priority:** Medium — AGENTS.md mandates lint before every commit, but the tooling isn't there
**Branch:** `feat/eslint-setup`
**Can run in parallel with:** any ticket that doesn't touch `package.json` / build config

## Problem

- `AGENTS.md` says "Always run lint and typecheck before committing" and suggests
  `npx next lint`, but the repo has **no ESLint config** (no `.eslintrc*`, no
  `eslint.config.*`) and no `lint` npm script.
- `next` is `~15.4.11`: `next lint` is deprecated in Next 15 and removed in 16 —
  running `npx next lint` opens an interactive "How would you like to configure
  ESLint?" prompt instead of linting (verified 2026-10-19 on the `feat/aziende`
  worktree).
- Current de-facto validation is `npx tsc --noEmit` + `vitest` only (this is what
  the aziende page work actually ran).

## Required work

1. Add ESLint flat config (`eslint.config.mjs`) using the Next.js ESLint preset
   (`eslint-config-next` → `next/core-web-vitals` + `@typescript-eslint`
   recommended). Do NOT rely on `next lint`: configure ESLint directly, as
   recommended by the Next.js 15 migration guide.
2. Add `"lint": "eslint ."` (and `"lint:fix": "eslint . --fix"`) to package.json
   scripts.
3. Baseline rules: start from `next/core-web-vitals` + TS recommended. The first
   run must end **green** on the existing codebase — fix real findings, tastefully
   disable the rest with inline `eslint-disable` comments or config, no blanket
   `--fix` churn.
4. Update `AGENTS.md` ("Build & Dev Commands" + "Commit conventions"): replace
   `npx next lint` with `npm run lint`.
5. Optional: wire `npm run lint` into CI if a workflow exists (check
   `.github/workflows/`).

## Acceptance criteria

- [ ] `npm run lint` exists, runs non-interactively, and passes on the current
      codebase
- [ ] `next lint` is no longer referenced anywhere in docs (AGENTS.md, README)
- [ ] `npx tsc --noEmit` and `npm test` still pass
- [ ] The lint setup commit contains config + script + docs only; any rule-driven
      code fixes go into separate commits

## Coordination

- Coordinate with open PRs touching `package.json` / build config to avoid conflicts.
- `feat/aziende` (aziende affiliate page, WIP, local only) will rebase on this once
  merged.
