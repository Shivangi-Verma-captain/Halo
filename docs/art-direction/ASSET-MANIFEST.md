# Asset Manifest

Source references (`/reference-images`) were **absent** from the repository at
build time — no images were found to adapt. All visuals below are therefore
**original procedural production assets** (drawn in code or authored as vector art), not placeholders
referencing missing files. If reference images are added later, map them here.

## Production assets (all original, no third-party artwork)

| Asset ID | Use | Format | Status |
|---|---|---|---|
| `village-ground` | Night meadow, plaza, paths, tufts, stars | Phaser Graphics (procedural) | ✅ integrated (`VillageScene.drawGround`) |
| `cottage-west/east` | Homes with golden windows | Phaser Graphics | ✅ integrated |
| `library` | Tiny library + teal door | Phaser Graphics | ✅ integrated |
| `clocktower` | Tower + readable clock face | Phaser Graphics | ✅ integrated |
| `observatory` | Dome + telescope slit | Phaser Graphics | ✅ integrated |
| `fountain` | Central fountain | Phaser Graphics | ✅ integrated |
| `garden-beds` | Moonflower beds | Phaser Graphics | ✅ integrated |
| `avatar-{moth,fox,owl,cat,frog,hare,badger,wren}` | 8 villagers (coat/trim per `AVATARS`) | Phaser Graphics (circle+hood) | ✅ integrated |
| `marker-clue` | Golden bobbing ring (clues) | Phaser Graphics | ✅ integrated |
| `marker-task` | Teal bobbing ring (tasks) | Phaser Graphics | ✅ integrated |
| `fireflies` | Ambient drifting lights | Phaser tweens | ✅ integrated (reduced-motion safe) |
| `sfx-*` | step/interact/clue/task/vote/phase/win/lose | WebAudio synth (`client/src/sound.ts`) | ✅ integrated, mutable |
| `village-dusk` | Storybook landing panorama: clocktower, observatory, cottages, square, fountain, and moon halo | SVG, 1600×720 | ✅ integrated (`client/public/assets/village-dusk.svg`); original hand-drawn vector art |

## Folders (reserved for future binary assets)
`client/public/assets/{backgrounds,characters,props,clues,ui,audio}/` — currently
intentionally empty; procedural rendering means the game ships with zero binary
weight. Add files here only with a manifest row (license + dimensions + transparency).

## To replace / upgrade later (optional polish, not blockers)
1. Hand-painted tilemap background (keep `SOLIDS` + spawn coords identical).
2. Per-avatar sprite frames (keep 34px body scale + name-label anchor).
3. Recorded ambience loop (keep WebAudio synth as fallback + mute control).
