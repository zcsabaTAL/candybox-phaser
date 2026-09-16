import { expect, test, type Page } from "@playwright/test";

const profile = process.env.CANDYBOX_TEST_PROFILE === "production"
  ? "production"
  : "development";

interface DebugState {
  player: { x: number; y: number };
}

async function holdKey(page: Page, key: string, milliseconds: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
}

async function holdUntilText(
  page: Page,
  key: string,
  selector: string,
  expected: string,
): Promise<void> {
  const target = page.locator(selector);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if ((await target.textContent()) === expected) {
      return;
    }
    await holdKey(page, key, 500);
  }

  await expect(target).toHaveText(expected);
}

async function readDebugState(page: Page): Promise<DebugState | undefined> {
  return page.evaluate(() => {
    return (window as Window & { __CANDYBOX_DEBUG__?: DebugState }).__CANDYBOX_DEBUG__;
  });
}

async function holdUntilCoordinate(
  page: Page,
  key: string,
  axis: "x" | "y",
  target: number,
  direction: "atMost" | "atLeast",
): Promise<number> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const state = await readDebugState(page);
    if (!state) {
      throw new Error("Development debug state is unavailable.");
    }

    const coordinate = state.player[axis];
    const reached = direction === "atMost"
      ? coordinate <= target
      : coordinate >= target;
    if (reached) {
      return coordinate;
    }

    await holdKey(page, key, 500);
  }

  const finalState = await readDebugState(page);
  if (!finalState) {
    throw new Error("Development debug state is unavailable.");
  }
  return finalState.player[axis];
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("./");
  await expect(page.locator("canvas")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.locator("canvas").click();

  (page as Page & { collectedErrors?: string[] }).collectedErrors = errors;
});

test.afterEach(async ({ page }) => {
  const errors = (page as Page & { collectedErrors?: string[] }).collectedErrors ?? [];
  expect(errors).toEqual([]);
});

test("loads the Candy Box screen in the requested build profile", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "CANDY BOX" })).toBeVisible();
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 0/1");
  await expect(page.locator("body")).toHaveAttribute("data-build-mode", profile);
});

test("moves the player, respects the boundary, and collects one candy", async ({ page }) => {
  if (profile === "development") {
    const initialState = await readDebugState(page);
    expect(initialState).toBeDefined();

    await holdKey(page, "ArrowRight", 500);

    const movedState = await readDebugState(page);
    expect(movedState).toBeDefined();
    expect(movedState!.player.x).toBeGreaterThan(initialState!.player.x);
  } else {
    const canvas = page.locator("canvas");
    const initialFrame = await canvas.screenshot();

    await holdKey(page, "ArrowRight", 500);

    const changedFrame = await canvas.screenshot();
    expect(changedFrame.equals(initialFrame)).toBe(false);
  }

  await holdUntilText(page, "ArrowRight", "#candy-counter", "Candies: 1/1");
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 1/1");
  await expect(page.locator("#game-status")).toHaveText("The first candy is yours.");

  await holdUntilText(
    page,
    "ArrowRight",
    "#game-status",
    "The edge of the box holds firm.",
  );
  await expect(page.locator("#game-status")).toHaveText("The edge of the box holds firm.");

  await holdKey(page, "ArrowLeft", 900);
  await holdKey(page, "ArrowRight", 900);
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 1/1");
});

test("constrains the player at all four arena walls in development", async ({ page }) => {
  test.skip(profile !== "development", "Exact coordinates are intentionally development-only.");

  const left = await holdUntilCoordinate(page, "ArrowLeft", "x", 56, "atMost");
  expect(left).toBe(56);

  const top = await holdUntilCoordinate(page, "ArrowUp", "y", 108, "atMost");
  expect(top).toBe(108);

  const right = await holdUntilCoordinate(page, "ArrowRight", "x", 744, "atLeast");
  expect(right).toBe(744);

  const bottom = await holdUntilCoordinate(page, "ArrowDown", "y", 420, "atLeast");
  expect(bottom).toBe(420);
});

test("exposes diagnostics only in development", async ({ page }) => {
  const debugState = await page.evaluate(() => {
    return (window as Window & { __CANDYBOX_DEBUG__?: unknown }).__CANDYBOX_DEBUG__;
  });

  if (profile === "development") {
    expect(debugState).toMatchObject({
      scene: "CandyBox",
      candy: { collected: false },
      candyCount: 0,
    });
  } else {
    expect(debugState).toBeUndefined();
  }
});

test("starts a clean run after reload", async ({ page }) => {
  await holdUntilText(page, "ArrowRight", "#candy-counter", "Candies: 1/1");
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 1/1");

  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 0/1");
});
