# Zak OS

A local agentic OS. It runs real coding agents (Claude Code, Hermes, Antigravity) on your machine, keeps every session, asks before anything risky, and turns your notes into a map. No API keys are stored: it drives the command line tools you are already signed in to.

The interface is called **Atlas**: a map room with contour-line backgrounds, a dark and a light theme, and a terrain view of your Obsidian vault. Design rules are in [DESIGN.md](DESIGN.md).

## What is inside

| Group | Pages |
| --- | --- |
| Workspace | Home (map of your projects), Projects, Tasks board, Reports |
| Agents | Agents (real CLI sessions), Workflows (orchestrator, workers, reviewer), Approvals (risk labels, batch actions), Automations |
| Knowledge | Brain (terrain map of the vault, time slider, search), Skills, Templates |
| Build | Git, Dev (run and preview a project), Files (editor, search, follow the agent), Terminal |
| Connections | Integrations (GitHub, Telegram, Discord, Slack), MCP servers, Webhooks and API key, Remote access |
| System | Usage and cost (budgets, forecast), Audit (export, archive), Team (accounts and roles), Licence, Settings |

First run opens a short setup tour. Settings has an appearance studio (accent, motion, background, density), a shortcut editor, module presets and backup/restore.

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

Email and calendar, Notion, Google and GitHub single sign-on, in-app payments and invoices, a multi-user shared server. These need provider accounts or hosted infrastructure, so they are left out rather than faked.
