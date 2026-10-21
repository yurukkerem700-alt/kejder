# 21 October 2026: rendering, sanctuary and arena bots

The 12-player arena was rendering eleven remote dragons through the full skin renderer, including scale textures, procedural membranes and horns. Low quality still incurred that geometry cost. Simulation-only steps also assigned native Canvas properties despite suppressing drawing calls.

## Changes

- Simulation-only steps use a plain JavaScript drawing sink. Native Canvas state is untouched; the real context is restored in `finally` by the existing loop.
- Crowded arenas use joint-driven curved silhouettes with wings, horns and skin colors. Combat keeps the original joints and hit tests. Small matches retain detailed skins.
- Remote fire has a smaller decorative particle budget. Severe sustained overload reduces effects and automatic resolution earlier. Gameplay timing remains 60 simulation steps per second when the device has sufficient capacity.
- Persistent decorative HUD animations are disabled during gameplay.
- The sanctuary has a weathered stone courtyard, gateway, headquarters, guards' building and supply building. Its static layer is cached and capped at 1536 pixels per side. Fountain, chest and tower combat remain dynamic. Upgrades invalidate the layer; offscreen towers keep fighting.
- Arena bots acquire and retain nearby targets faster, lead observed target movement, dodge visible breath, briefly retreat at critical health and steer away from the shrinking boundary. Growth comes from combat, replacing fabricated farming statistics. AI receives facing and fire states from the existing player snapshots.
- Service-worker cache is version 24; arena script URL is version 8.

## Verification

`tests/arena-runtime.cjs` runs the real page and gameplay bridge in Chromium. Playwright must be available to Node. Optional `CHROMIUM_EXECUTABLE_PATH` selects a browser; `CHROMIUM_SINGLE_PROCESS=1` supports restricted containers. `BASELINE_REF=bfc39cbb5509e1bf02d4f831213c7996d74636e2` enables before/after comparison. `CPU_RATE=4` applies Chrome's CPU slowdown to the live rendering sample.

```sh
node tests/arena-runtime.cjs
```

The 1280x720, 11-remote-dragon scenario reduced median JavaScript draw-step time from approximately 18–22 ms to 1–2 ms in software-rendered headless Chromium. This measures command generation, not a guaranteed user-device FPS. The suite separately samples live drawing with raster/compositor work and optional CPU slowdown; those results vary with host load.

Verified: target pursuit and damage; breath avoidance; ghost exclusion; boundary steering; a simulated one-minute 11-bot battle with eliminations; sanctuary cache reuse and upgrade invalidation; native-context restoration; pause behavior; no page JavaScript exceptions. Networked play between two physical devices and production deployment still require verification. Vercel project inspection currently returns 403 for the connected team's scope.
