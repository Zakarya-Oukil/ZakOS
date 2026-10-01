# Zak OS

A local agentic OS. It runs real coding agents (Claude Code, Hermes, Antigravity) on your machine, keeps every session, asks before anything risky, and turns your notes into a map. No API keys are stored: it drives the command line tools you are already signed in to.

The interface is called **Atlas**: a map room with contour-line backgrounds, a dark and a light theme, and a terrain view of your Obsidian vault. Design rules are in [DESIGN.md](DESIGN.md).

## What is inside

| Group | Pages |
| --- | --- |
| Workspace | Home (a map of your projects with the agents working on them), Projects (groups, tags, standing instructions, GitHub issues and PRs), Tasks board, Reports |
| Agents | Agents (voice in and out, fork, compare answers, ask several at once, search every conversation, per-session model and permissions, session templates, cost meter, tool timeline), Workflows (route map, dry run, cost estimate, auto-stop, flows with conditions and retries, run comparison), Approvals (risk labels, batch, always-allow rules), Automations (cron, commit, file, webhook and chain triggers, quiet hours, calendar) |
| Knowledge | Brain (terrain map, live activity, orphan and link finder, timeline, agent memory, quick capture with Alt+N), Skills (import after review, try on a sample, usage, export), Templates |
| Build | Git (stash, merge with conflict helper, cherry-pick, pull requests, commit messages written from the staged diff), Dev (several apps and a port map, environment profiles, log filter, deploy recipe), Files, Terminal (split panes, record and replay, saved commands, ask for a command) |
| Connections | Integrations (GitHub, Telegram, Discord, Slack), MCP servers (with usage log), Webhooks and API key, Remote access |
| System | Usage and cost, Audit (export, archive, saved filters, alert rules), Team, Licence, Settings |

First run opens a short setup tour. Settings has an appearance studio, a shortcut editor, module presets and backup/restore.

## Run it

Requires Node 22 or newer, Git, and at least one of the `claude`, `hermes` CLIs.

```bash
npm install
npm run dev          # Vite on :5173 and the API on 127.0.0.1:4000
```

Production, one process:

```bash
npm run build
npm run server:start # serves the built app and the API on 127.0.0.1:4000
```

## Security model

- The API listens on **127.0.0.1 only**. Requests that arrive through a tunnel (forwarded headers or a foreign Host) are treated as remote and refused by every local-only route.
- Terminal, Files, secrets, MCP and settings are local-only, always.
- **Remote access** is opt-in, needs sign-in, and exposes only the approvals list and approve/dismiss, for owner and operator accounts.
- Tokens live in an AES-256-GCM encrypted file unlocked with a master password that is never stored. Webhooks are HMAC-SHA256 signed; the personal API key is stored as a hash.
- Files are confined to registered project folders. Key material (`.pem`, `.key`, `.ssh`, the secrets file) and `.env` contents are never shown.
- Every agent prompt is preceded by a git checkpoint and written to the audit log with credentials redacted.

## Licensing (for sellers)

Offline Ed25519 keys. The app ships with `licence/public.pem` only.

```bash
node scripts/licence.mjs keygen                                  # once; the private key goes to ~/.zak-os-licence/
node scripts/licence.mjs issue --plan pro --name "Acme Ltd" --days 365
```

Plans: Free, Pro (Integrations, MCP, Webhooks, Templates, Reports), Team (adds Remote access and Team). Without a key, those pages show an upgrade page. Nothing is deleted. Point the Upgrade button and the update check at your own links in the Licence page.

## Layout

```
server/          Express API, agent runners, workflows, SQLite (data/zakos.db)
server/os/       tasks, files, usage, reports, secrets, integrations, webhooks, MCP, auth, licence, backup
src/os/          the app: shell, theme, ui kit, modules/<page>
src/legacy/      the previous UI, still reachable at #/legacy
scripts/         licence tool
```

## Not included yet

Email and calendar, Notion, Google and GitHub single sign-on, in-app payments and invoices, a multi-user shared server (all need provider accounts or hosted infrastructure, so they are left out rather than faked). Also not built: approving from a desktop notification button, per-session tags, and a free-form node editor for flows (flows are step lists drawn as a route).
