# CVLT Web - Project Context

## What is this?
The paragliding club website [cvlt.ch](https://cvlt.ch) for **Club Volo Libero Ticino**.
The site is live in production. Current work is iterating on details and adding features following `TODO.md` and `plans/`.

## Production Setup
- **Production**: `cvlt.ch` — pulls from `main` branch (Infomaniak hosting)
- `dev` branch is the working branch — tested locally, then merged to `main` for production deploy

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
- Follow `TODO.md` for current priorities and `plans/` for planned features
- The `plans/` directory contains research/plan documents for upcoming work

## Git & Worktree Setup

This project uses **git worktrees**. The branches live in separate directories:

The bare repo lives at `/home/ruben/repos/cvlt/cvlt-web/` with a `.bare/` directory inside it. All worktrees are subdirectories of this bare repo:

| Branch | Directory | Purpose |
|:---|:---|:---|
| `main` | `/home/ruben/repos/cvlt/cvlt-web/main` | Production (cvlt.ch) |
| `dev` | `/home/ruben/repos/cvlt/cvlt-web/dev` | Development (local) |
| `feat/*` | `/home/ruben/repos/cvlt/cvlt-web/feat-*` | Feature branches |

To create a new feature worktree (run from any existing worktree):
```bash
git worktree add /home/ruben/repos/cvlt/cvlt-web/feat-<name> -b feat/<name>
```

### Deploy pipeline
1. Work on `dev` branch (current directory is `/home/ruben/repos/cvlt/cvlt-web/dev`)
2. Test locally with `npm run dev`
3. Run the AI review: `bash scripts/ai-review.sh` (GitHub Copilot gpt-4.1 via the `gh` CLI; exit 2 = FAIL and blocks the deploy)
4. Push to `origin dev`
5. Create PR from dev to main (via `gh pr create`)
6. Wait for CI to pass
7. Merge PR → then click **Deploy** in the Infomaniak panel (merging alone does not deploy)

### Production deploy (Infomaniak panel)

Settings configured in the panel (not in the repo): Node.js 24, build command
`npm run deploy:timed`, run command `npm start`, port 3000. The app lives at
`/srv/customer/sites/cvlt.ch` on the host; the panel restarts it automatically
after the build command exits. SSH access exists (credentials via Infomaniak
panel — never in this public repo).

What `scripts/deploy-timed.sh` does on each panel deploy: `git pull origin
main` → DB migrations → timed build. Two things worth knowing:

- **Self-healing script**: the panel launches the checkout's copy of the script
  as it exists when deploy is clicked. If the pull updates the script itself,
  it re-execs the fresh version (since d447926), so script changes ship
  atomically with the deploy that introduces them.
- **Migrations are automatic** — `payload migrate` runs on every deploy (the
  `echo y` answers Payload's one-time prompt about the historic drizzle-push
  batch; committed migrations are safe to apply). Never run migrations
  manually after a deploy.

The only manual deploy step: **new env vars in `.env` on the server** (via
panel file manager or SSH). PRs that add a required env var must call this out
in the PR description. Verify a deploy by tailing `logs/deploy-timing.*.log`
and `logs/server.log` on the host.

### How to merge into main from the dev worktree
```bash
gh pr create --base main --head dev --title "deploy: description" --body "summary"
gh pr merge <number> --merge
```
Do NOT `git checkout main` in the dev worktree. Use PR-based merges via `gh`.

### Commit conventions
- Commit messages in English, imperative mood (e.g. "add contact section")
- Always run lint and typecheck before committing
- Never force push. Never use `--no-verify`.

## Build & Dev Commands
- `npm run dev` — dev server with Turbopack
- `npm run build` — production build (includes Payload importmap generation)
- `npm run start` — production start
- Lint: `npx next lint` (or check package.json scripts)
- Typecheck: `npx tsc --noEmit`

## Screenshot Feedback
When the user shares a screenshot during a session, automatically check it against the latest changes to provide visual feedback. Screenshots are saved to `~/Pictures/Screenshots/`.
