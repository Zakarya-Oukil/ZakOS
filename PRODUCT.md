# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Zakarya, a cybersecurity master's student and software engineer, using Zak OS daily on their own Windows machine as a personal agentic operating system. It is being prepared to sell to clients (developers and small teams) who each run their own copy, switch modules on and off, and unlock higher plans with an offline licence key.

## Product Purpose
A local agentic OS platform that runs on the owner's machine without API keys. It wraps real coding agents (Claude Code now, Hermes, Antigravity later) so every prompt lands in a real, saved CLI session that can be listed, resumed, stopped and deleted. Success: the owner works through the OS instead of separate terminals, and can watch agents and their memory live.

## Positioning
Not a desktop or macOS-style skin. A sidebar-and-top-bar platform in the family of the agentic OS builds shown by Jack Roberts, Jay E / RoboNuggets, Chase AI and Julian Goldie (shared Obsidian memory, live agent-team boards, local-only, domains to skills to automations). Sessions are real CLI sessions, not a simulated chat.

## Operating Context
- Windows 11, Node 24, Vite + React front end, Express + WebSocket server on :4000 (proxied from :5173).
- Agents: `claude` CLI (subscription login, no API key) and `hermes` CLI. Antigravity has no headless CLI yet.
- Memory: an Obsidian vault at `C:\Users\Zakar\Documents\Obsidian\My_Vault`, exposed through `/api/vault/*`.
- Every agent prompt is preceded by a git checkpoint and logged, so tracked-file changes can be restored.

## Capabilities and Constraints
- Pages: Home, Agents, Projects, Tasks, Files, Reports, Brain (terrain map of the vault), Workflows, Approvals, Automations, Skills, Templates, Git, Dev, Terminal, Integrations, MCP servers, Webhooks and keys, Remote access, Usage and cost, Audit, Team, Licence, Settings. Each page has its own top bar.
- Modular: a module registry decides what appears in the sidebar; modules can be toggled.
- Agents run under the CLI's normal permission system (`acceptEdits` by default). Fully permission-free runs were the owner's stated preference but are not enabled.
- Sessions live server-side (SQLite at `data/zakos.db`) and are grouped per agent.
- Old UI is archived under `src/legacy/` and ported module by module.
- Licensing: offline Ed25519 keys (Free, Pro, Team). Premium pages show an upgrade page, never delete data. Pricing and payment provider are the seller's choice.
- Security: the API binds 127.0.0.1 only. Remote access is opt-in, needs sign-in, and exposes approvals only. Terminal, files and secrets never leave the machine.

## Brand Commitments
Name: Zak OS. Concept: Atlas, a cartographic map room (see DESIGN.md). Not a fake OS desktop and not "AI slop". Dark ink-teal and light chart-paper themes, a vermilion accent for live state, chartreuse for done, Bricolage Grotesque with Geist Mono, chamfered panels, pill buttons, contour-line background. Motion is cinematic but optional (Full, Calm, Off).

## Evidence on Hand
No customers, testimonials or benchmarks exist. Do not invent any. The Hermes account currently returns a billing error (model locked) on real runs.

## Product Principles
1. Real over simulated: sessions, files and vault data come from the actual CLIs and disk.
2. Every automated action is logged and reversible where possible.
3. The interface stays out of the way of long-running work; state (running, idle, error) is always legible.
4. Features are modules the owner can turn on or off.

## Accessibility & Inclusion
Keyboard reachable controls, visible focus, reduced-motion support, and contrast of at least 4.5:1 for text.
