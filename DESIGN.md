# FirstFrame design system

## Concept card
- **Idea:** you are on a film set with a real camera in front of you: dark stage, one warm key light, and the gear lit like a product shot.
- **Metaphor:** a cinema set and grading suite. Stage black, flags and duvetyne, a tungsten key light, a cool daylight rim, silver-halide prints.
- **Signature:** the 3D camera on a lit stage with the lens rail beside it. Lenses roll past like a focus pull, and the one in focus is large and lit.
- **Emotion:** the first three seconds should feel quiet, expensive and precise, like walking onto a lit set.
- **Motion verb:** "pull focus". Things ease into sharpness: opacity, slight scale and clip reveals on a fast-out ease, never bouncy.
- **Screenshot:** the camera in tungsten and cyan light, with the lens rail beside it, the focused lens large and its neighbours falling away.

## Palette (dark is the default; light is the "contact sheet" option)
| Role | Dark | Light | Source in the concept |
|------|------|-------|-----------------------|
| ground | `#0A0A0B` stage black | `#E9E9E6` contact-sheet grey | the set floor; a print-room table |
| surface | `#121214` flag | `#F6F6F4` | black flags, cards |
| surface2 | `#1A1A1D` | `#DEDED9` | raised controls |
| ink | `#EEEAE3` silver halide | `#121214` | print highlights |
| muted | `#A29D94` grey card | `#57554F` | 18% grey card (AA on both grounds) |
| line | `#252428` | `#CBCAC4` | hairlines (about 12% ink) |
| accent | `#F2A541` tungsten | `#9C5408` | the 3200K key light, the focus, the selected lens. Used sparingly |
| rim | `#7FB3C6` daylight | `#2E6A80` | cool rim light, info only |
| rec | `#E5484D` | `#C9373C` | recording and destructive only |

The amber accent was already the camera-screen accent, so it ties the page to the camera's own UI. It is a warm tungsten, not acid, and the cool rim keeps it from being a single-accent identity.

## Type
Unchanged families (already cinematic): Big Shoulders Display for posters and h1/h2, Barlow Condensed for UI labels, Instrument Sans for body, IBM Plex Mono for readouts. Numbers use tabular figures.

## Shape and texture
- Radius: 12px for cards and stages, 8px for controls, 999px for chips only.
- A static film-grain layer (SVG noise, 3.5%) over the whole page. A vignette on the 3D stage.

## Motion language
- Ease: `cubic-bezier(.16, 1, .3, 1)` (expo-out), used for everything.
- Durations: 140ms (press), 220ms (hover), 520ms (view and reveal), 800ms (titles).
- One clock: GSAP's ticker drives Lenis smooth scroll and the lens rail.
- Reduced motion: native scroll, no reveals, everything visible.

## Scrolling
- Lenis smooth scroll (lerp 0.14, fast to settle).
- Inner scrollers (side panels, the simulator deck, the lens rail, the 3D canvas) keep native wheel behaviour through Lenis `prevent`.
- The scrollbar is themed: thin graphite on stage black, turning tungsten on hover.

## Idle state
The 3D stage carries the life (the model renders continuously and responds to the pointer). The page around it stays still at rest by decision: it is a learning tool, and moving text competes with the model.
