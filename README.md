[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/miologalo/best-game-orbit-gardener/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/miologalo/best-game-orbit-gardener/reward.svg)](https://make.fun/bounty/best-game-01)

# Orbit Gardener

A make.fun [best-game-01](https://make.fun/bounty/best-game-01) entry: tend a garden on
small asteroids orbiting a sun. Plant seeds, water them, grow blooms — and hop away when a
meteor warning flashes.

**Goal:** grow 12 blooms before the 90-second season ends. **Lose:** the last heart is
gone, or the season ends with fewer than 12 blooms.

- **A / D or ← / →** — hop between asteroids (inner teal, middle coral, outer amber)
- **Mouse** — click a soil patch to plant a seed or water a plant
- **Space / W** — tend the patch that needs it most on your rock
- **P / Esc** — pause, **R** — restart

Plants need three waterings to bloom, and a plant left dry droops, catches blight, then
withers — water it to save it. Meteors strike a rock every few seconds; a red ring
warns you first, and a hit destroys the plants there (and costs a heart if you are
standing on it).

The game is plain static files under `game/` — one canvas, ES modules, WebAudio
synthesized sounds, no library, no network request, nothing to download. Play it with:

```
node serve.ts
```

then open http://localhost:8080. Screenshots are deterministic scenes staged by
`game/src/shots.js` (`?shot=start|play|blight|win&seed=1`).

Hand the entry in with `node main.ts` (`MAKEFUN_OUTPUT_DIR=out` outside the grader).
