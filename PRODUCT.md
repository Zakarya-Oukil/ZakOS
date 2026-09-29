# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Zakarya, a cybersecurity master's student and software engineer, using Zak OS daily on their own Windows machine as a personal agentic operating system. Later, possibly sold to clients, who would add or remove features. Right now it is for one person.

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
- Pages: Agents, Brain (3D neural-galaxy view of the vault, click a node to open the note), Workflows (orchestrator, sub-agents, reviewer, then the owner), Terminal, Settings. Each page has its own top bar.
- Modular: a module registry decides what appears in the sidebar; modules can be toggled.
- Agents run under the CLI's normal permission system (`acceptEdits` by default). Fully permission-free runs were the owner's stated preference but are not enabled.
- Sessions live server-side (SQLite at `data/zakos.db`) and are grouped per agent.
- Old UI is archived under `src/legacy/` and ported module by module.
- Undecided: pricing, licensing and client packaging.

## Brand Commitments
Name: Zak OS. Owner asked for a cinematic HUD feel, alive and animated (GSAP and Motion), explicitly not a fake OS desktop and not "AI slop". Accent direction agreed: ice cyan for live and agent state, amber for review and alerts, on a graphite base.

## Evidence on Hand
No customers, testimonials or benchmarks exist. Do not invent any. The Hermes account currently returns a billing error (model locked) on real runs.

## Product Principles
1. Real over simulated: sessions, files and vault data come from the actual CLIs and disk.
2. Every automated action is logged and reversible where possible.
3. The interface stays out of the way of long-running work; state (running, idle, error) is always legible.
4. Features are modules the owner can turn on or off.

## Accessibility & Inclusion
Keyboard reachable controls, visible focus, reduced-motion support, and contrast of at least 4.5:1 for text.
