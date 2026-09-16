import { expect, test, type Page } from "@playwright/test";

const profile = process.env.CANDYBOX_TEST_PROFILE === "production" ? "production" : "development";
type LocationKey = "CandyBox" | "Village" | "FortressEntrance";

interface DebugState {
  scene: LocationKey;
  player: { x: number; y: number };
  camera: { scrollX: number; scrollY: number };
  candy: { collected: boolean };
  candyCount: 0 | 1;
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

async function goToVillage(page: Page): Promise<void> {
  await holdUntilText(page, "ArrowRight", "#location-title", "THE VILLAGE");
}

async function goToFortress(page: Page): Promise<void> {
  await goToVillage(page);
  await holdUntilText(page, "ArrowRight", "#location-title", "FORTRESS ENTRANCE");
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
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
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 0/1");
  await expect(page.locator("body")).toHaveAttribute("data-build-mode", profile);
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

  await holdUntilText(page, "ArrowRight", "#candy-counter", "Candies: 1/1");
  await goToVillage(page);
  await expect(page.locator("#location-mood")).toHaveText("Warm windows watch the winding road.");
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 1/1");

  if (profile === "development") {
    const village = await readDebugState(page);
    expect(village).toMatchObject({ scene: "Village", candyCount: 1 });
    expect(village!.player.x).toBeLessThan(400);
    await holdKey(page, "ArrowRight", 1800);
    expect((await readDebugState(page))!.camera.scrollX).toBeGreaterThan(0);
  }

  await holdUntilText(page, "ArrowRight", "#location-title", "FORTRESS ENTRANCE");
  await expect(page.locator("#location-mood")).toHaveText("The stone gate counts every footstep.");
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 1/1");
  await holdUntilText(page, "ArrowLeft", "#location-title", "THE VILLAGE");
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 1/1");
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

test("constrains all four outer walls in development", async ({ page }) => {
  test.skip(profile !== "development", "Exact coordinates are intentionally development-only.");
  expect(await holdUntilCoordinate(page, "ArrowLeft", "x", 56, "atMost")).toBe(56);
  expect(await holdUntilCoordinate(page, "ArrowUp", "y", 100, "atMost")).toBe(100);
  expect(await holdUntilCoordinate(page, "ArrowDown", "y", 704, "atLeast")).toBe(704);
  await goToFortress(page);
  expect(await holdUntilCoordinate(page, "ArrowRight", "x", 1344, "atLeast")).toBe(1344);
});

test("exposes diagnostics only in development", async ({ page }) => {
  const debugState = await readDebugState(page);
  if (profile === "development") {
    expect(debugState).toMatchObject({ scene: "CandyBox", candy: { collected: false }, candyCount: 0 });
  } else {
    expect(debugState).toBeUndefined();
  }
});

test("starts a clean run after reload", async ({ page }) => {
  await holdUntilText(page, "ArrowRight", "#candy-counter", "Candies: 1/1");
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#location-title")).toHaveText("CANDY BOX");
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 0/1");
});
