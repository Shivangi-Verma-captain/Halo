# Art Direction — Who Stole the Moon?

## Identity
Cozy storybook fantasy with a quirky indie personality. Hand-crafted imperfection:
crooked roofs, uneven garden rows, lopsided fountain. Layered, matte shapes with
soft lantern bloom, clear silhouettes, and a dusk gradient; no photorealism.
The landing panorama is original 1600×720 vector art. The active Phaser map uses
the same architecture and palette, with the readable ground plane kept separate
from the walkable simulation and collision rules.

## Palette (authoritative)
| Use | Hex | Notes |
|---|---|---|
| Midnight indigo (sky/UI base) | `#1A1B3A` | page + canvas background |
| Deep panel | `#26264D` | HUD, banners |
| Dusty lavender (secondary) | `#B9A8D9` | eyebrow text, observatory dome |
| Muted teal (plants/tasks) | `#8FD6B4` / `#4E6B62` | garden, task markers |
| Warm golden windows/clues | `#F2C572` | windows, clue glimmers, primary accent |
| Cream surfaces | `#F7EAD7` | cards, panels, avatar ring |
| Restrained coral (alerts/culprit) | `#E88CA0` | whispers, errors, garden flowers |

## Typography
- Display: **Fraunces** (serif, storybook title treatment).
- Body/UI: **Karla** (legible, warm). Minimum 13–14px for gameplay text.
- Hierarchy: title > phase banner > panel headings > body > hints.

## Characters
Eight villagers share a consistent scale (34px body), warm cream outline,
two-dot face, and name label. Species-specific ear silhouettes and small marks
(moth antennae, owl brows, frog eye bumps, badger blaze) distinguish them at a
glance; coat and trim colors remain sourced from `AVATARS` in
`shared/src/constants.ts`. These in-engine sprites are intentionally simple
procedural art; individually illustrated and animated character sheets remain a
future art upgrade.

## Environment
Flat-shaded districts: night-meadow base `#2C3A55`, concentric plaza and hand-laid
cobbles, broken flower clusters, tuft grass, and a star strip at the northern
edge. Buildings are drawn in-scene with roof seams, divided glowing windows,
doors, pots, and cast shadows. The clock face and fountain are landmarks; the
observatory anchors the distant garden. Fireflies drift (disabled under
`prefers-reduced-motion`).

## UI principles
- Village stays visible: journal/tasks/chat/villagers live in a slide-in drawer
  or bottom sheet, never fullscreen except results.
- One primary action per moment (Join / Investigate / Vote / New Mystery).
- Primary actions use a warm gold label, raised edge, hover lift, and pressed
  response; secondary controls use quiet cream outlines. Focus remains visible.
- Sound is decorative (WebAudio synth), mutable, never required.
- Landing layout stacks below 760px; game tools wrap/scroll while preserving the
  Phaser play area. Drawers remain progressive-disclosure panels.
