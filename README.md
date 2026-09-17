# Candy Box Phaser prototype

This separate prototype tests how productively a small Candy Box successor can be built and verified with AI coding agents.

## Playable scope

- Phaser 3 with strict modern TypeScript and Vite.
- A three-location mini-world: Candy Box, Village, and Fortress entrance.
- Keyboard movement and boundary collision.
- One collectible candy and a visible counter.
- Camera follow, two-way scene transitions, and runtime candy continuity.
- Main theme playback after the first browser gesture, with an automatic Fortress theme change.
- A blacksmith interaction with recorded dialogue, captions, and background-music ducking.
- Versioned local save for location, position, and candy count, plus a New game reset.
- A visible two-step objective and an explicit prototype completion state at the Fortress entrance.
- Development and production Playwright gates.
- GitHub Pages deployment only after both profiles pass.

## Commands

```text
npm ci
npm run dev
npm run build:dev
npm run build:prod
npm test
```

This repository intentionally contains no Candy Box 2 save compatibility or CB3 migration architecture.
