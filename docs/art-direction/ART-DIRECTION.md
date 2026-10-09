# Art Direction — Who Stole the Moon?

## Identity
Cozy storybook fantasy with a quirky indie personality. Hand-crafted imperfection:
crooked roofs, uneven garden rows, lopsided fountain. Painterly flat shapes,
clear silhouettes, subtle grain via layered alpha — no photorealism.

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
Eight villagers, consistent proportions: round body (~34px), hood triangle,
two dot eyes, cream outline, name label above. Distinguished by coat/trim color
only (see `AVATARS` in `shared/src/constants.ts`) — keeps sprites readable at
small sizes and avoids mismatched art styles.

## Environment
Flat-shaded districts: night-meadow base `#2C3A55`, plaza rings, path strokes,
tuft triangles, star strip along the top. Buildings drawn in-scene (no stretched
illustrations): cottages with glowing windows, clock tower with readable face,
observatory dome, fountain with highlight. Fireflies drift (disabled under
`prefers-reduced-motion`).

## UI principles
- Village stays visible: journal/tasks/chat/villagers live in a slide-in drawer
  or bottom sheet, never fullscreen except results.
- One primary action per moment (Join / Investigate / Vote / New Mystery).
- Sound is decorative (WebAudio synth), mutable, never required.
