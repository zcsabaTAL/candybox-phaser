import { expect, test, type Page } from "@playwright/test";

const profile = process.env.CANDYBOX_TEST_PROFILE === "production" ? "production" : "development";
type LocationKey = "CandyBox" | "Village" | "FortressEntrance";

interface DebugState {
  scene: LocationKey;
  player: { x: number; y: number };
  camera: { scrollX: number; scrollY: number };
  candy: { collected: boolean };
  candies: number;
  lollipops: number;
  woodenSwordOwned: boolean;
}

async function holdKey(page: Page, key: string, milliseconds: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function holdUntilText(page: Page, key: string, selector: string, expected: string): Promise<void> {
  const target = page.locator(selector);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if ((await target.textContent()) === expected) return;
    await holdKey(page, key, 500);
  }
  await expect(target).toHaveText(expected);
}

async function readDebugState(page: Page): Promise<DebugState | undefined> {
  return page.evaluate(() => (window as Window & { __CANDYBOX_DEBUG__?: DebugState }).__CANDYBOX_DEBUG__);
}

async function holdUntilCoordinate(
  page: Page,
  key: string,
  axis: "x" | "y",
  target: number,
  direction: "atMost" | "atLeast",
): Promise<number> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const state = await readDebugState(page);
    if (!state) throw new Error("Development debug state is unavailable.");
    const coordinate = state.player[axis];
    const reached = direction === "atMost" ? coordinate <= target : coordinate >= target;
    if (reached) return coordinate;
    await holdKey(page, key, 500);
  }
  const finalState = await readDebugState(page);
  if (!finalState) throw new Error("Development debug state is unavailable.");
  return finalState.player[axis];
}

async function moveToDoorHeight(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const state = await readDebugState(page);
    if (!state) throw new Error("Development debug state is unavailable.");
    if (state.player.y >= 360 && state.player.y <= 440) return;
    await holdKey(page, state.player.y > 440 ? "ArrowUp" : "ArrowDown", 100);
  }
  throw new Error("Player did not reach the doorway height.");
}

async function goToVillage(page: Page): Promise<void> {
  await holdUntilText(page, "ArrowRight", "#location-title", "THE VILLAGE");
}

async function goToFortress(page: Page): Promise<void> {
  await goToVillage(page);
  await holdUntilText(page, "ArrowRight", "#location-title", "FORTRESS ENTRANCE");
}

async function collectCandy(page: Page): Promise<void> {
  const goal = page.locator("#goal-candy");
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if ((await goal.getAttribute("class"))?.includes("complete")) return;
    await holdKey(page, "ArrowRight", 500);
  }
  await expect(goal).toHaveClass(/complete/);
}

async function approachBlacksmith(page: Page): Promise<void> {
  const prompt = page.locator("#interaction-prompt");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await prompt.isVisible() && (await prompt.textContent()) === "Press E to talk to the blacksmith") return;
    await holdKey(page, "ArrowUp", 250);
  }
  await expect(prompt).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  page.once("dialog", (dialog) => dialog.accept());
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "New game" }).click(),
  ]);
  await expect(page.locator("canvas")).toBeVisible();
  await page.evaluate(async () => { await document.fonts.ready; });
  (page as Page & { collectedErrors?: string[] }).collectedErrors = errors;
});

test.afterEach(async ({ page }) => {
  const errors = (page as Page & { collectedErrors?: string[] }).collectedErrors ?? [];
  expect(errors).toEqual([]);
});

test("loads the Candy Box in the requested build profile", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "CANDY BOX" })).toBeVisible();
  await expect(page.locator("#location-mood")).toHaveText("A single candy hums in the dark.");
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 0");
  await expect(page.locator("body")).toHaveAttribute("data-build-mode", profile);
  await expect(page.locator("#objective-text")).toHaveText("Find the glowing candy in the Candy Box.");
  await expect(page.locator("#completion-card")).toBeHidden();
});

test("guides the player to the fortress and marks the prototype complete", async ({ page }) => {
  test.setTimeout(60_000);
  await expect(page.locator("#goal-candy")).not.toHaveClass(/complete/);
  await collectCandy(page);
  await expect(page.locator("#goal-candy")).toHaveClass(/complete/);
  await expect(page.locator("#objective-text")).toHaveText(
    "Follow the marked doorways to the Fortress Entrance.",
  );

  await goToFortress(page);
  await expect(page.locator("#goal-fortress")).toHaveClass(/complete/);
  await expect(page.locator("#objective-text")).toHaveText("Prototype goal complete.");
  await expect(page.locator("#completion-card")).toBeVisible();
  await expect(page.locator("#completion-card")).toContainText("You reached the Fortress Entrance.");

  await page.reload();
  await expect(page.locator("#completion-card")).toBeVisible();
});

test("moves, collects the candy, and keeps it through the mini-world", async ({ page }) => {
  if (profile === "development") {
    const initial = await readDebugState(page);
    expect(initial).toBeDefined();
    await holdKey(page, "ArrowRight", 500);
    const moved = await readDebugState(page);
    expect(moved!.player.x).toBeGreaterThan(initial!.player.x);
  } else {
    const canvas = page.locator("canvas");
    const initialFrame = await canvas.screenshot();
    await holdKey(page, "ArrowRight", 500);
    expect((await canvas.screenshot()).equals(initialFrame)).toBe(false);
  }

  await collectCandy(page);
  await goToVillage(page);
  await expect(page.locator("#location-mood")).toHaveText("Warm windows watch the winding road.");
  await expect(page.locator("#candy-counter")).toContainText("Candies:");

  if (profile === "development") {
    const village = await readDebugState(page);
    expect(village).toMatchObject({ scene: "Village", candy: { collected: true } });
    expect(village!.player.x).toBeLessThan(400);
    await holdKey(page, "ArrowRight", 1800);
    expect((await readDebugState(page))!.camera.scrollX).toBeGreaterThan(0);
  }

  await holdUntilText(page, "ArrowRight", "#location-title", "FORTRESS ENTRANCE");
  await expect(page.locator("#location-mood")).toHaveText("The stone gate counts every footstep.");
  await expect(page.locator("#candy-counter")).toContainText("Candies:");
  await holdUntilText(page, "ArrowLeft", "#location-title", "THE VILLAGE");
  await expect(page.locator("#candy-counter")).toContainText("Candies:");
});

test("queues the main theme, unlocks it with a gesture, and changes it at the fortress", async ({ page }) => {
  const audio = page.locator("#location-music");
  await expect(audio).toHaveAttribute("data-track", "music/main-theme.mp3");
  const beforeGesture = await audio.evaluate((element: HTMLAudioElement) => ({
    paused: element.paused,
    volume: element.volume,
    source: element.currentSrc,
  }));
  expect(beforeGesture.paused).toBe(true);
  expect(beforeGesture.volume).toBeCloseTo(0.35);
  expect(beforeGesture.source).toContain("/music/main-theme.mp3");

  await page.locator("canvas").click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
  await goToFortress(page);
  await expect(audio).toHaveAttribute("data-track", "music/fortress-entrance.mp3");
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
  const atFortress = await audio.evaluate((element: HTMLAudioElement) => ({
    volume: element.volume,
    source: element.currentSrc,
  }));
  expect(atFortress.volume).toBeCloseTo(0.35);
  expect(atFortress.source).toContain("/music/fortress-entrance.mp3");
});

test("talks to the blacksmith with captions and music ducking", async ({ page }) => {
  test.setTimeout(60_000);
  const context = page.context();
  await page.close();
  const forgePage = await context.newPage();
  await forgePage.addInitScript(() => {
    localStorage.setItem("candyboxPhaserSave", JSON.stringify({
      saveVersion: 2, location: "Forge", position: { x: 700, y: 370 }, candies: 0,
      candyCollected: false, lollipops: 0, forgeLollipopCollected: false, woodenSwordOwned: false,
    }));
  });
  await forgePage.goto("./");
  await expect(forgePage.locator("#location-title")).toHaveText("THE FORGE");
  await expect(forgePage.locator("#interaction-prompt")).toHaveText("Press E to talk to the blacksmith");

  await forgePage.keyboard.press("e");
  const voice = forgePage.locator("#dialogue-voice");
  const music = forgePage.locator("#location-music");
  await expect(forgePage.locator("#dialogue-caption")).toHaveText(
    "Hi! I'm a blacksmith. I can sell you various weapons and pieces of equipment.",
  );
  await expect(forgePage.locator("#dialogue-caption")).toBeVisible();
  await expect.poll(() => voice.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
  expect(await music.evaluate((element: HTMLAudioElement) => element.volume)).toBeCloseTo(0.1225);

  await expect.poll(() => voice.evaluate((element: HTMLAudioElement) => element.paused), {
    timeout: 15_000,
  }).toBe(true);
  await expect(forgePage.locator("#dialogue-caption")).toBeHidden();
  expect(await music.evaluate((element: HTMLAudioElement) => element.volume)).toBeCloseTo(0.35);
  await forgePage.close();
});

test("finds the forge lollipop and buys one wooden sword into the inventory", async ({ page }) => {
  test.setTimeout(60_000);
  const seed = {
    saveVersion: 2,
    location: "Forge",
    position: { x: 700, y: 620 },
    candies: 149,
    candyCollected: false,
    lollipops: 0,
    forgeLollipopCollected: false,
    woodenSwordOwned: false,
  };
  const context = page.context();
  await page.close();
  const forgePage = await context.newPage();
  await forgePage.addInitScript((initialSave) => {
    if (sessionStorage.getItem("forgeTestSeeded")) return;
    localStorage.setItem("candyboxPhaserSave", JSON.stringify(initialSave));
    sessionStorage.setItem("forgeTestSeeded", "true");
  }, seed);
  await forgePage.goto("./");
  await expect(forgePage.locator("#location-title")).toHaveText("THE FORGE");

  await approachBlacksmith(forgePage);
  await forgePage.keyboard.press("e");
  await expect(forgePage.locator("#shop-panel")).toBeVisible();
  await expect(forgePage.locator("#buy-wooden-sword")).toBeDisabled();

  if (profile === "development") {
    await holdUntilCoordinate(forgePage, "ArrowLeft", "x", 430, "atMost");
    await holdUntilCoordinate(forgePage, "ArrowUp", "y", 305, "atMost");
    await expect.poll(() => forgePage.evaluate(
      () => JSON.parse(localStorage.getItem("candyboxPhaserSave")!).lollipops,
    )).toBe(1);
  }
  await forgePage.close();

  const purchasePage = await context.newPage();
  await purchasePage.addInitScript(() => {
    if (sessionStorage.getItem("forgePurchaseSeeded")) return;
    localStorage.setItem("candyboxPhaserSave", JSON.stringify({
      saveVersion: 2, location: "Forge", position: { x: 700, y: 540 }, candies: 150,
      candyCollected: false, lollipops: 1, forgeLollipopCollected: true, woodenSwordOwned: false,
    }));
    sessionStorage.setItem("forgePurchaseSeeded", "true");
  });
  await purchasePage.goto("./");
  await approachBlacksmith(purchasePage);
  await purchasePage.keyboard.press("e");
  await purchasePage.locator("#buy-wooden-sword").click();
  await expect(purchasePage.locator("#shop-message")).toContainText("added to your inventory");
  await purchasePage.locator("#inventory-toggle").click();
  await expect(purchasePage.locator("#inventory-items")).toContainText("Wooden Sword");
  await expect(purchasePage.locator("#inventory-items")).toContainText("Lollipop × 1");

  await purchasePage.reload();
  await purchasePage.locator("#inventory-toggle").click();
  await expect(purchasePage.locator("#inventory-items")).toContainText("Wooden Sword");
  await expect(purchasePage.locator("#inventory-items")).toContainText("Lollipop × 1");
  const saved = await purchasePage.evaluate(() => JSON.parse(localStorage.getItem("candyboxPhaserSave")!));
  expect(saved).toMatchObject({ candies: 0, lollipops: 1, forgeLollipopCollected: true, woodenSwordOwned: true });
  await purchasePage.close();
});

test("keeps movement active when revisiting scenes", async ({ page }) => {
  test.setTimeout(60_000);

  await goToVillage(page);
  await holdUntilText(page, "ArrowLeft", "#location-title", "CANDY BOX");
  await holdUntilText(page, "ArrowRight", "#location-title", "THE VILLAGE");
  await holdUntilText(page, "ArrowRight", "#location-title", "FORTRESS ENTRANCE");
  await holdUntilText(page, "ArrowLeft", "#location-title", "THE VILLAGE");
  await holdUntilText(page, "ArrowRight", "#location-title", "FORTRESS ENTRANCE");
});

test("changes location only through the doorway", async ({ page }) => {
  test.setTimeout(60_000);
  await holdKey(page, "ArrowUp", 2_000);
  await holdUntilText(page, "ArrowRight", "#game-status", "The wall is solid. Find the doorway.");
  await expect(page.locator("#location-title")).toHaveText("CANDY BOX");
  await holdKey(page, "ArrowDown", 1_200);
  await goToVillage(page);
  await expect(page.locator("#location-title")).toHaveText("THE VILLAGE");
});

test("constrains all four outer walls in development", async ({ page }) => {
  test.setTimeout(60_000);
  test.skip(profile !== "development", "Exact coordinates are intentionally development-only.");
  expect(await holdUntilCoordinate(page, "ArrowLeft", "x", 56, "atMost")).toBe(56);
  expect(await holdUntilCoordinate(page, "ArrowUp", "y", 100, "atMost")).toBe(100);
  expect(await holdUntilCoordinate(page, "ArrowDown", "y", 704, "atLeast")).toBe(704);
  await moveToDoorHeight(page);
  await goToFortress(page);
  expect(await holdUntilCoordinate(page, "ArrowRight", "x", 1344, "atLeast")).toBe(1344);
});

test("exposes diagnostics only in development", async ({ page }) => {
  const debugState = await readDebugState(page);
  if (profile === "development") {
    expect(debugState).toMatchObject({ scene: "CandyBox", candy: { collected: false }, candies: 0 });
  } else {
    expect(debugState).toBeUndefined();
  }
});

test("saves progress across reload and supports a new game", async ({ page }) => {
  test.setTimeout(60_000);
  await collectCandy(page);
  await goToVillage(page);
  await holdKey(page, "ArrowUp", 350);

  const positionBeforeReload = profile === "development" ? (await readDebugState(page))!.player : undefined;
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#location-title")).toHaveText("THE VILLAGE");
  await expect(page.locator("#candy-counter")).toContainText("Candies:");
  if (profile === "development") {
    const restored = await readDebugState(page);
    expect(restored!.player.x).toBeCloseTo(positionBeforeReload!.x, -1);
    expect(restored!.player.y).toBeCloseTo(positionBeforeReload!.y, -1);
  }

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.locator("#location-title")).toHaveText("CANDY BOX");
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 0");
  await expect(page.locator("#objective-text")).toHaveText("Find the glowing candy in the Candy Box.");
  await expect(page.locator("#completion-card")).toBeHidden();
  const freshSave = await page.evaluate(() => JSON.parse(localStorage.getItem("candyboxPhaserSave") ?? "null"));
  expect(freshSave).toEqual({
    saveVersion: 2,
    location: "CandyBox",
    position: { x: 105, y: 400 },
    candies: 0,
    candyCollected: false,
    lollipops: 0,
    forgeLollipopCollected: false,
    woodenSwordOwned: false,
  });
});
