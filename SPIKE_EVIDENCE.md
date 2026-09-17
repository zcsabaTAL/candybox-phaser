# Phaser prototype process evidence

## Session 1: agent-verifiable loop

- Started: 2026-09-16T20:06:18+02:00
- First playable Pages build verified: 2026-09-16T20:28:25+02:00
- Elapsed time to verified first playable Pages build: 22 minutes 7 seconds
- Playable implementation commit: `7d1d08d21709b624095b990d2c49bb5275cd9503`
- Pages URL: https://zcsabatal.github.io/candybox-phaser/
- First agent solution accepted without human correction: no. The gameplay was accepted, but the test evidence required reviewer-directed hardening.
- Human correction rounds: 1. The gameplay was accepted, but reviewer feedback required stronger movement and collision evidence.
- Agent independently ran the development build: yes
- Agent independently ran the production build: yes
- Agent independently ran development Playwright tests: yes, 5 passed after review hardening
- Agent independently ran production Playwright tests: yes, 4 passed and 1 development-only test skipped after review hardening
- Agent independently completed browser verification: yes, automated Chromium interaction plus visual screenshot inspection
- Playwright test-level retries: 0
- Assertion-level timing tolerance: at most 10 rounds of 500 ms keyboard input while waiting for an observable target state
- Post-review browser coverage: development verifies player coordinates and all four walls; production retains a canvas liveness check and observable collection and right-wall behavior

### Session 1 acceptance target

One Candy Box screen with keyboard movement, boundary collision, one collectible candy, a visible counter, development and production browser gates, and a deployed GitHub Pages build.

### Session 2 risk carryover

Session 2 must test both scene transitions and minimum viable audio playback. Full dialogue, captions, ducking, and saving remain Session 3 scope.

- Queue the desired music before browser audio is unlocked.
- Release autoplay blocking only after a real click or keyboard gesture.
- Check audio only after that gesture.
- Verify the actual `<audio>` element state, especially `paused` and `volume`, rather than trusting an internal audio API status.
- Exercise the check across at least one location transition so scene lifecycle and sound lifecycle are tested together.

## Session 2: mini-world

- Started: 2026-09-16T20:45:00+02:00
- Playable implementation commit: `c5eeb8525651192517f6658537d3a473125b9101`
- Scope: Candy Box, Village, Fortress entrance, two-way transitions, camera follow, runtime candy continuity, and minimum viable browser audio.
- Music choice: no player-facing selector. The main theme is active at startup, waits for the first real gesture, and changes automatically at the Fortress entrance.
- Full dialogue, captions, ducking, preferences, and saved progress remain Session 3 scope.
- First agent solution accepted without human correction: no. Manual testing found a movement lock when revisiting a scene.
- Human correction rounds: 1. Revisited Phaser scenes retained their transition lock and stopped accepting movement. Scene-entry state is now reset and covered by a repeated round-trip regression test.
- Agent independently ran the development and production builds: yes
- Agent independently ran development Playwright tests: yes, 7 passed
- Agent independently ran production Playwright tests: yes, 6 passed and 1 development-only test skipped
- Playwright test-level retries: 0
- Assertion-level timing tolerance: at most 12 rounds of 500 ms keyboard input for long-distance traversal, plus bounded polling for actual audio playback state

## Session 3: interaction and save

- Started: 2026-09-16
- Scope: one blacksmith interaction, recorded dialogue, captions, music ducking, and a clean versioned local save for location, position, and candy count.
- Save format: `saveVersion: 1`; no Candy Box 2 compatibility or migration layer.
- First agent solution accepted without human correction: no. Manual review requested deterministic New game behavior and doorway-only location transitions.
- Human correction rounds: 2. Manual review first required deterministic New game behavior and doorway-only travel. The follow-up exposed a final-frame save race that could retain the old location while resetting candies.
- Agent correction rounds before human review: 2. The browser suite found position staleness at reload and a same-frame transition save ordering fault.
- Agent independently ran the development build: yes
- Agent independently ran the production build: yes
- Agent independently ran development Playwright tests: yes, 9 passed
- Agent independently ran production Playwright tests: yes, 8 passed and 1 development-only test skipped
- Agent independently completed browser verification: yes, automated interaction and persistence coverage plus visual Chromium screenshot inspection
- Playwright test-level retries: 0
- Post-review coverage: New game writes a known version-1 default before reload, and horizontal scene transitions require the player to be inside the visible doorway opening.
- New game hardening: restart is now signaled in the navigation URL and the newly loaded runtime writes the default save, so the departing scene cannot overwrite it.

## Session 4: decision build

- Started: 2026-09-17
- Scope: visible two-step objective, concise control guidance, explicit Fortress completion feedback, final regression coverage, and a written spike decision.
- Save format remains `saveVersion: 1`. Completion is derived from the existing candy and location state.
- Technical recommendation: keep Phaser as the candidate foundation and proceed to a target-player test before starting a broader feature phase.
- Product recommendation: pending observation of two target players aged 11 to 12.
- Playwright test-level retries: 0
- Assertion-level timing tolerance: at most 12 rounds of 500 ms keyboard input for long-distance traversal, plus bounded polling for actual audio playback state
- Agent independently ran the development and production builds: yes
- Agent independently ran development Playwright tests: yes, 10 passed
- Agent independently ran production Playwright tests: yes, 9 passed and 1 development-only test skipped
- Final deployment evidence: pending CI and Pages verification

## Session 5: Forge and inventory

- Started: 2026-09-17
- Scope: original-game candy production, enterable Forge, one collectible lollipop, 150-candy Wooden Sword purchase, inventory, and version-2 save migration.
- Corrected caption: `Hi! I'm a blacksmith. I can sell you various weapons and pieces of equipment.`
- Agent independently ran the development and production builds: yes
- Agent independently ran development Playwright tests: yes, 11 passed
- Agent independently ran production Playwright tests: yes, 10 passed and 1 development-only test skipped
- Human correction rounds before manual review: 0
- Agent correction rounds: 3, covering transition save ordering, isolated save seeding, and deterministic Forge-door interaction.
- Final deployment evidence: pending CI and Pages verification
- CI optimization: development and production browser gates retain their full coverage but run as two parallel matrix jobs. Tests inside each profile remain single-worker to avoid introducing Phaser and audio timing contention.
