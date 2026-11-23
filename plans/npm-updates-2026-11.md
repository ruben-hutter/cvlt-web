# Dependency Updates — Decisions, Findings & Smoke Test

Task: clear all 32 npm audit vulnerabilities (2 critical, 13 high, 17 moderate) + full refresh.
Branch: `feat/npm-updates` (commits `4eda09f`, `db78122`, `8def311`)
Outcome: **`npm audit` → 0 vulnerabilities**; `tsc --noEmit` clean, `npm test` 21/21, `npm run build` green.

---

## Why Next 16 was required (not just attempted)

The task brief suggested `next ~15.5.29` as the safe security fix, with Next 16 as a
stretch goal. Reality on the registry:

- `@payloadcms/next@3.91.0` peers:
  `>=15.2.9 <15.3.0 || >=15.3.9 <15.4.0 || >=15.4.11 <15.5.0 || >=16.3.3 <17.0.0`
- `@payloadcms/next@3.94.1` peers:
  `>=15.2.9 <15.3.0 || >=15.3.9 <15.4.0 || >=15.4.11 <15.5.0 || >=16.4.5 <17.0.0`

**Payload deliberately excludes 15.5.x entirely** (they only allow specific patch versions
they've verified). And there are no 15.4.x patches beyond 15.4.11 — which still has the
2 open criticals. So within Next 15 there was *no* 0-vuln combination. Next `16.4.5+`
is the only peer-allowed, fully fixed line → **next `~16.4.6`**. All gates passed on it.

## Version changes

| Package | Before | After | Note |
|:--|:--|:--|:--|
| next | ~15.4.11 | ~16.4.6 | forced by peer ranges (see above) |
| payload family | ^3.79.1 | **3.94.1 exact** | lockstep exact-pins (see resolver fight below) |
| nodemailer | ^8.0.3 | ^10.6.1 | ships own types → `@types/nodemailer` **removed** |
| sharp | ^0.32.6 | ^0.35.5 | libvips 8.18.7, verified working |
| vitest | ^4.1.10 | ^5.1.1 | no config changes needed |
| typescript | ^5.0.0 | ^7.0.2 | native compiler; see TS7 section |
| @types/node | ^22 | ^24 | matches Node 24 runtime (26 exists but inaccurate) |
| react / react-dom | ^19.0.0 | ^19.3.1 | in-range refresh |
| tailwindcss etc. | 4.2.x / 0.5.19 | 4.3.5 / 0.5.20 | in-range refresh |
| graphql | ^16.9.0 | ^16.15.0 | **kept on 16** — payload peers `^16.8.1`, 17 conflicts |

## npm resolver fight (ERESOLVE) and the overrides

Fresh install failed repeatedly (no lockfile — it's gitignored, resolution is from scratch):

1. `@payloadcms/*` packages drifted to different versions (db-sqlite 3.94.1 vs next 3.91.0)
   because each payload release **exact-pins its siblings as peers** (`payload: "3.94.1"`).
2. `payload-totp` peers `payload/@payloadcms/*: ^3.88.0` (ranges). npm's backtracking on
   range-peers vs exact-pin-peers never converged — it kept seating `@payloadcms/ui@3.91.0`
   and erroring.

Fix: exact-pin all direct `@payloadcms/*` + `payload` to `3.94.1` **and** override the
transitive lockstep siblings:

```json
"overrides": {
  "@payloadcms/ui": "3.94.1",
  "@payloadcms/translations": "3.94.1"
}
```

## Transitive advisories with no upstream fix → targeted overrides

These four were unfixable by version choice alone (exact-pins or dead upstreams):

| Advisory | Chain | Override |
|:--|:--|:--|
| dompurify ≤3.4.16 (XSS) | monaco-editor@0.57.0 pins `dompurify: 3.4.15` exactly | `dompurify: ^3.4.18` |
| happy-dom ≤21.0.3 (high, code exec/SSRF) | @lexical/headless@0.50.0 → `happy-dom ^20.9.0` (all headless releases affected; fix is 21.0.4) | `happy-dom: 21.0.4` (major-crossing, verified via build/tests/pages) |
| esbuild ≤0.24.2 (dev server) | drizzle-kit@0.31.7 (exact-pinned by db-sqlite) → deprecated `@esbuild-kit` → old esbuild; "No fix available" upstream | scoped: `"@esbuild-kit/core-utils": { "esbuild": "0.28.2" }` |
| postcss-selector-parser <6.1.5 (ReDoS-ish CPU) | @tailwindcss/typography pins `6.0.10` exactly | scoped: `"@tailwindcss/typography": { "postcss-selector-parser": "^6.1.5" }` |

## TypeScript 7 (native) — kept

`tsc` 7.0.2 only complained about one removed option: `baseUrl`. Dropped it from
tsconfig (paths without baseUrl resolve relative to tsconfig since TS 4.1; Next is fine
with it). After that: `tsc --noEmit` clean, tests green, build green,
`payload generate:types` works. Kept on ^7.0.2.

Next 16's build also auto-codemodded tsconfig: `jsx: preserve → react-jsx`,
added `.next/dev/types/**` to include. Committed as-is.

## Next 16 code migrations (beyond deps)

1. **`src/middleware.ts` → `src/proxy.ts`** via `npx @next/codemod@canary
   middleware-to-proxy . --force` (the `--force` was only to bypass its clean-tree check;
   only untracked files were present). Codemod renamed file + export `middleware`→`proxy`,
   nothing else. Removes the deprecation warning; proxy runs on the Node.js runtime.
2. **`opengraph-image.tsx`**: removed `export const runtime = 'edge'` — Edge Runtime is
   deprecated in 16 and `next/og` works on the default Node.js runtime. This was the
   source of the remaining "Edge Runtime is deprecated" startup warning.
3. **AGENTS.md**: `next dev` appends a managed `<!-- BEGIN:nextjs-agent-rules -->` block
   and re-adds it whenever it's missing/uncommitted. Committed once, per the block's own
   guidance, to keep future trees clean.

## Smoke test (dev server, Next 16.4.6)

Setup: copied `db/payload.db` (3.8 MB) from the dev worktree and symlinked its `media/`
inside this worktree (removed again afterwards). `npm run dev` on port 3000 — **zero
warnings** after the two fixes above; request log confirms `proxy.ts` handling each request.

| Check | Result |
|:--|:--|
| `/`, `/notizie` + 3 article pages, `/galleria` + album page, `/calendario`, `/shop`, `/vento`, `/admin`, `/robots.txt` | all **200** |
| Media files (`/api/media/file/p1070675….jpg`) | **200, image/jpeg**, full-size originals served |
| sharp 0.35.5 direct test (resize→webp 400px, metadata on 4000×3000 JPEG) | works (sharp 0.35.5 / libvips 8.18.7 on Node 24) |
| nodemailer 10.6.1 | `createTransport` + **live SMTP verify (STARTTLS + AUTH) OK against mail.infomaniak.com** — no email sent |

## Open observations (not regressions, candidates for tickets)

- `/opengraph-image` (the un-hashed path) returns **410 Gone** — the proxy's
  old-WordPress-post heuristic (`single segment, no dot, not in knownRootPaths`) catches
  it. Identical logic existed in the old middleware, so OG image serving was presumably
  already affected in production. Next serves metadata images under a hashed URL
  (`/opengraph-image-<id>`), which the heuristic also catches — worth verifying whether
  OG images render anywhere and adding the prefix to `skipPaths` if needed.
- `package-lock.json` is gitignored in this repo → every install resolves fresh. The
  overrides make the payload-family resolution deterministic; without them any fresh
  install can hit the ERESOLVE fight described above.
- graphql stays on 16 until payload moves its peer range to 17.

---

## Production-mode simulation (added after first smoke test)

Ran the exact production path locally (`npm run build` + `npm run start` →
`scripts/start.mjs` → `.next/standalone/server.js`) on Next 16.4.6 / payload 3.94.1.
All green: all pages 200 (fast — standalone), media 200, CSP + security headers
present, `/wp-content/*` 410 via proxy, `/feed` + `/calendario.ics` + vento APIs 200.

Notes:
- Trailing-slash and old-page redirects now answer **308** (Next core's permanent
  redirect) instead of the middleware's 301 — semantically equivalent for SEO, browsers
  treat both as permanent. Caused by Next handling redirects before proxy.
- Local-only quirk: standalone `server.js` binds `process.env.HOSTNAME` (→ Tailscale IP
  here); on Infomaniak the env differs, behavior unchanged by this update.
- `/opengraph-image-<hash>` still 410 (pre-existing proxy heuristic, see above).

## Production deploy checklist (Infomaniak)

Deploy = `git pull` + `npm install` + `npm run build` **on the host** (deploy-timed.sh).
Biggest risks: on-host build memory (Next 16 builds with **Turbopack by default**),
fresh npm resolution, sharp binaries, email, image upload path.

**Before deploy — baseline current prod:**
- [ ] curl the `og:image` URL from a current article's HTML and record the status
      (expect 410 — pre-existing; confirm so it's not blamed on the deploy)
- [ ] Note current memory usage in `logs/server.log` (start.mjs logs rss every 5 min)

**On Infomaniak panel:**
- [ ] Confirm Node.js version for the site = 24
- [ ] Check plan memory limit. If `next build` dies/OOM on-host, switch to the
      documented fallback: `next build --webpack` (one-line change in package.json)

**Deploy window:**
- [ ] Let the prebuild step snapshot `db/payload.db` into `.backups/` (keep last 30) —
      verify a fresh backup file exists before switching traffic
- [ ] Watch deploy log: `npm install` must resolve with NO ERESOLVE errors (the
      overrides make this deterministic — any error means registry drift, stop and check)
- [ ] Watch Turbopack build complete; standalone copy/symlink steps OK
- [ ] Restart app; check `logs/server.log`: "Ready", foehn cache warm line, rss stable

**Post-deploy smoke on cvlt.ch (~15 min):**
- [ ] Public: `/`, `/notizie` + 1 article, `/galleria` + 1 album, `/calendario`,
      `/vento` (live data), `/shop`, `/info-volo`, `/comitato`
- [ ] Any gallery image loads full-size (sharp 0.35 on host)
- [ ] **Admin: upload a test image** (only path exercising sharp write + thumbnail/
      medium generation on prod), verify variants, then delete it
- [ ] Admin login with 2FA (payload-totp 3.0.7 vs payload 3.94.1 lockstep), edit +
      publish a news item, open live preview
- [ ] Email from host: submit **contact form** → check recipient inbox; ideally also one
      membership/shop-order flow (real nodemailer 10 createTransport on host SMTP)
- [ ] curl from laptop: security headers on https://cvlt.ch, 410 on `/wp-content/...`
      and an old article URL, trailing-slash redirect, `/feed`, `/calendario.ics`,
      og:image status (compare to baseline)
- [ ] GoatCounter still counting (CSP entry unchanged)
- [ ] Monitor `logs/server.log` 30–60 min: rss trend, no repeated errors

**Rollback plan:** previous `main` commit via git on the host (or Infomaniak git
rollback); restore DB from `.backups/` if needed; restart. Watch for payload schema
changes 3.79→3.94: check admin CRUD works; `npm run db:migrate:status` if SQL errors
appear in the log.
