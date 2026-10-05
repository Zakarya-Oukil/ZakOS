# Design system: Atlas

Zak OS is a map room. Projects are land, notes are peaks, agents are expeditions, and the interface is the table the map sits on. This file records what shipped, so new screens follow the same rules.

## Concept
- **Territory, not desktop.** A sidebar and per-page top bar, never a fake OS window.
- **Contours as the one motif.** The page background is a live contour map that bends around the cursor. Home draws projects as islands with contour rings. Brain is a shader-drawn terrain. Nothing else is decorated.

## Colour
All colour is a CSS variable on `:root` in `src/os/theme/tokens.css`, with a dark and a light set. Components never use raw hex.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--os-bg` | `#0a1513` ink-teal | `#edf0ec` chart paper | page |
| `--os-surface`, `--os-surface-2` | translucent teal | translucent paper | panels |
| `--os-line`, `--os-contour` | `#1f3733`, `#2f5a4a` | `#cdd6cc`, `#a9bdae` | borders, map lines |
| `--os-text`, `--os-muted` | `#e8efe9`, `#8fa89f` | `#14231f`, `#55695f` | text |
| `--os-cyan` (the accent) | vermilion `#ff6a3d` | `#b83a12` | live state, primary action, selection |
| `--os-ok` | chartreuse `#c3e64a` | `#4d6a08` | done, success |
| `--os-amber` | `#e9b949` | `#8a5d00` | caution |
| `--os-danger` | `#ff4d4d` | `#c42b2b` | errors |

The token is still named `--os-cyan` because every page already uses it; its value is the accent. The owner can swap the accent in Settings (vermilion, chartreuse, cobalt, saffron, orchid). Every pair was checked for 4.5:1 contrast on both themes.

## Type
- **Bricolage Grotesque** (variable, self-hosted) for everything with a voice: headings, UI, body.
- **Geist Mono** (self-hosted) for data only: paths, commands, timestamps, code.
- Headings are heavy and tight (`font-extrabold`, `tracking-tight`). Body is 14 to 15px with a 65 to 72ch measure. Nothing below 12px.

## Shape
- Panels have one chamfered top-right corner (`.os-chamfer`), the signature shape. Nested panels use `square`.
- Buttons are pills. Inputs and selects are 10px radius. Cards inside lists use the 8px radius.
- No side-stripe borders, no gradient text, no glow halos.

## What makes it its own
- **Display voice.** `.os-display` is Bricolage at 78% width and weight 800: page titles, the greeting, empty-state titles and section headings. Everything else stays at normal width.
- **Shape-coded state.** Status markers differ by shape, not only colour: hollow ring (idle), ring with a travelling arc (working), half disc (needs review), solid diamond (failed).
- **Open sections.** Read-only summaries on Home use `Panel bare`: a heading and a rule, no box. Boxes are kept for things you edit or act on.
- **Contour glyphs.** Empty states carry a generated contour glyph seeded from their title, so each page's empty state is its own.
- **The map answers.** The background drifts to a different region of the terrain for each page, and a ripple leaves the Agents or Approvals item when a run ends or an approval arrives.
- **Page reveal.** A page opens outward from the nav item you pressed (clip-path, 600ms), then drops the clip.
- **Route, not list.** A workflow's plan is drawn as a route with waypoints that fill as work finishes.

## Components (`src/os/ui`)
`Panel` (boxed or bare), `Button` (primary, outline, ghost), `DiffView` (unified or side by side), `ContourGlyph`, `IconButton`, `Tabs`, `Segmented`, `Field`, `EmptyState`, `ErrorNote`, `SuccessNote`, `Skeleton`, `CommandPalette`, `Markdown`. Icons are Phosphor duotone through one `IconContext`.

## Motion
- One authored moment per surface: the setup intro, the Brain fly-to, the Home island ring that breathes when an agent runs.
- Everything else is quick state feedback (150 to 220ms, ease-out).
- Settings has Full, Calm and Off. The system's reduced-motion setting always wins. The background canvas pauses when the tab is hidden.

## Rules for new screens
1. One primary button per view. Everything else is outline or ghost.
2. Empty states say what the page is for and give the one action that fills it.
3. Errors name the problem and the way out. Success notes are short.
4. Real data only. No invented metrics, testimonials or logos.
5. Check both themes, keyboard only, and `prefers-reduced-motion` before calling a screen done.

## Verification used
Playwright through system Chrome, axe-core (WCAG 2 A and AA) on all 24 pages in both themes with zero violations, and `impeccable detect` on the source and the live page.

## World: J.A.R.V.I.S. (rebuilt 2026-10-05)
Deep navy ground (`#040a14`), arc-reactor cyan (`#5fe3ff`), amber for anything that needs the owner. Exo 2 for display, Geist for text, Geist Mono for numbers and paths only. Sentence case everywhere; no caps labels, no glowing boxes: panels are a faint wash with corner ticks that appear on hover or focus.
- **The orb** (`src/os/worlds/jarvis/JarvisOrb.tsx`) is the one bold element. It sits top-centre in the header and reads the agent socket (`orbStore.ts`): idle, thinking (a session runs, no tool open), running (a tool call is open, arc shows steps done), error (a run failed, a permission was refused, or approvals are waiting). Click opens Approvals when something waits, Agents otherwise.
- **Flat fallback:** reduced motion, Appearance motion off, a slow GPU (first 90 frames averaging over 34 ms) or `localStorage zakos_orb_flat=1` draw flat rings with no blur or animation.
- **Boot** (`JarvisBoot.tsx`): once per browser session, about 2 s, three beats (pulse, name plus real API/link/vault checks, orb docks into the header). Any key or click skips. Reduced motion never shows it.
- Focus rings are drawn in `worlds.css` for this world because Tailwind reads `shadow-[var(--os-focus-ring)]` as a colour.
- Figma frames: file `97Uk4XRAHSwQTWZLN3WWDW`, page J.A.R.V.I.S. (Agents, Orb states, Boot sequence).
