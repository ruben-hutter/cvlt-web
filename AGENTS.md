# CVLT Web - Project Context

## What is this?
The paragliding club website [cvlt.ch](https://cvlt.ch) for **Club Volo Libero Ticino**.
The site is live in production. Current work is iterating on details and adding features following `TODO.md` and `plans/`.

## Production Setup
- **Production**: `cvlt.ch` — pulls from `main` branch (Infomaniak hosting)
- `main` is the integration branch: feature worktrees merge into it and `/deploy` pushes it (see "Git & Worktree Setup")

## Tech Stack (not negotiable)
| Layer | Tech |
|:---|:---|
| Framework | **Next.js** (latest, App Router) |
| CMS | **Payload 3.0** (embedded in Next.js) |
| Database | **SQLite** via `@payloadcms/db-sqlite` |
| Styling | **Tailwind CSS** |
| Runtime | **Node.js 24 LTS** |
| Email | **Nodemailer** via Infomaniak SMTP (transactional) |
| Hosting | **Infomaniak** shared hosting (one Node.js process per site) |

## Site Sections (all live)
- **Homepage** — hero, latest news, events sidebar, TMA Locarno, Twint donations
- **News** (`/notizie`) — listing + article pages, search, pinned news
- **Events / Calendar** (`/calendario`) — calendar UI, event detail pages, iCal subscription
- **Gallery** (`/galleria`) — single page with year/album filters, lightbox, video support
- **Vento & Meteo** (`/vento`) — live wind stations, pressure chart, föhn forecast
- **Info volo** (`/info-volo`) — airspace info, webcams, useful links
- **Comitato** (`/comitato`) — committee members grid
- **Shop** (`/shop`) — products, Twint + invoice payment, email notifications
- **Gare** (`/gare`) — CCC Hall of Fame, Hike & Fly, Regio Sud calendars
- **Voli in Biposto** (`/biposto`) — tandem flight info
- **Contact** (`/contatto`) — contact form with email notification
- **Membership** (`/adesione`) — membership form with email confirmation

## Payload Collections
- **News**: title, slug, content (RichText), date, thumbnail, category, author, pinned
- **Events**: title, slug, date (start + end), location, backup date, description, external link
- **Media**: images + video, alt text, admin search by alt
- **PhotoAlbums**: title, slug, year, images, thumbnail
- **MembershipForm**: form submissions + triggers email
- **ShopOrders**: order tracking + email notifications

## Key Architecture Notes
- Payload admin panel at `/admin`
- SQLite DB file on disk — in `.gitignore`, backed up via prebuild script (keeps last 30)
- Analytics: GoatCounter (privacy-friendly, no cookies)
- Security: CSP headers, rate limiting, 2FA on all admin users, XSS escaping

## Language
Italian only. Multilingual possible in the future (see TODO.md).

## Repo & Hosting
- GitHub repo: `cvlt_web` (public, Ruben's account)
- Infomaniak install method: **Git** (HTTPS clone URL in Infomaniak panel)
- Infomaniak plan: Web hosting 250GB / 20 sites / ~130 CHF/year

## Design Direction
Modern, clean, fast. Tailwind utility classes.

## Working Conventions
- Work items are GitHub issues in `ruben-hutter/cvlt-web`, via the `gh` CLI (`gh issue list`; migrated from the former TODO.md). Label vocabulary: `docs/agents/triage-labels.md` (default five-role vocabulary — label string = role name), tracker conventions: `docs/agents/issue-tracker.md`
- `ready-for-agent` issues are fully specified — an agent can pick them up directly; `needs-triage` issues need scoping first
- The `plans/` directory contains research/plan documents and detailed ticket specs referenced by issues
- Domain docs: single-context `GLOSSARY.md` + `docs/adr/` at the repo root; conventions in `docs/agents/domain.md`

## Git & Worktree Setup

This project uses **git worktrees**. The branches live in separate directories:

The bare repo lives at `/home/ruben/repos/cvlt/cvlt-web/` with a `.bare/` directory inside it. All worktrees are subdirectories of this bare repo:

| Branch | Directory | Purpose |
|:---|:---|:---|
| `main` | `/home/ruben/repos/cvlt/cvlt-web/main` | Integration branch — what Infomaniak pulls (cvlt.ch) |
| `dev` | `/home/ruben/repos/cvlt/cvlt-web/dev` | Legacy, being retired (may still hold WIP) |
| `feat/*` | `/home/ruben/repos/cvlt/cvlt-web/<name>` | Feature branches (one worktree per feature) |

To create a new feature worktree, use `wtree` (run from any existing worktree): `wtree feature <name> <brief-file>` creates `<repo>/<name>` on branch `feat/<name>` and installs the task brief as `TASK.md` there:
```bash
wtree feature <name> <brief-file>
```

### Deploy pipeline
`main` is the integration branch and is never edited or committed to directly. It only moves by fast-forward: `wtree finish` merges features in, `/deploy` pushes it, and `git pull --ff-only origin main` in the `main` worktree syncs it after a PR was merged on GitHub.

1. Work in a feature worktree on `feat/<name>`; test locally with `npm run dev` there
2. `wtree finish <name>` (from the main worktree session) — rebases `feat/<name>` onto `main` and fast-forward merges it. Finish gates: the full test suite passes in the worktree, `/skill:code-review` ran and its findings are addressed, the tree is clean
3. `/deploy` from the `main` worktree (see `.pi/prompts/deploy.md`) — dependency-tree check, lint + typecheck, clean-`main` check, review gate `scripts/ai-review.sh` (GitHub Copilot gpt-4.1 via the `gh` CLI; exit 2 = FAIL and blocks the push), then `git push origin main`
4. CI (`.github/workflows/ci.yml`) runs on every push to `main` as a post-push safety net — it no longer gates the deploy
5. Click **Deploy** in the Infomaniak panel → the panel runs `scripts/deploy-timed.sh` on the host (git pull, migrations, build) and restarts the app. Pushing alone does not deploy.

No more PRs from `dev` to `main`: PRs are no longer part of the normal path.

### Production deploy (Infomaniak panel)

Settings configured in the panel (not in the repo): Node.js 24, build command
`npm run deploy:timed`, run command `npm start`, port 3000. The app lives at
`/srv/customer/sites/cvlt.ch` on the host; the panel restarts it automatically
after the build command exits. SSH access exists (credentials via Infomaniak
panel — never in this public repo).

What `scripts/deploy-timed.sh` does on each panel deploy: `git pull origin
main` → DB migrations → timed build. Three things worth knowing:

- **Self-healing script**: the panel launches the checkout's copy of the script
  as it exists when deploy is clicked. If the pull updates the script itself,
  it re-execs the fresh version (since d447926), so script changes ship
  atomically with the deploy that introduces them.
- **Migrations are automatic** — `payload migrate` runs on every deploy (the
  `echo y` answers Payload's one-time prompt about the historic drizzle-push
  batch; committed migrations are safe to apply). Never run migrations
  manually after a deploy.
- **Installs are `npm ci`** — `package-lock.json` is committed and is the single
  source of truth for the dependency tree. `deploy-timed.sh` installs nothing
  itself; the timed build (`scripts/build-timed.sh`) runs `npm ci` before
  `npm run build`, and CI does the same. When `package.json` changes,
  regenerate the lockfile in the same commit (`npm install`) — an
  out-of-sync lockfile fails every `npm ci` loudly.

The only manual deploy step: **new env vars in `.env` on the server** (via
panel file manager or SSH). PRs that add a required env var must call this out
in the PR description. Verify a deploy by tailing `logs/deploy-timing.*.log`
and `logs/server.log` on the host.

### How to merge into main and deploy
```bash
# from the main worktree session, once the feature's finish gates pass:
wtree finish <name>   # rebase feat/<name> onto main, fast-forward merge it
```
Then `/deploy` in the `main` worktree session (review gate + `git push origin main`), then **Deploy** in the Infomaniak panel — steps 2–5 of the pipeline above.

### Commit conventions
- Commit messages in English, imperative mood (e.g. "add contact section")
- Always run lint and typecheck before committing
- Never force push. Never use `--no-verify`.

## Build & Dev Commands
- `npm ci` — install exactly `package-lock.json` (never `npm install` on the host or in CI)
- `npm run dev` — dev server with Turbopack
- `npm run build` — production build (includes Payload importmap generation)
- `npm run start` — production start
- Lint: `npx next lint` (or check package.json scripts)
- Typecheck: `npx tsc --noEmit`

## Screenshot Feedback
When the user shares a screenshot during a session, automatically check it against the latest changes to provide visual feedback. Screenshots are saved to `~/Pictures/Screenshots/`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
