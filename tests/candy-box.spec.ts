import { expect, test, type Page } from "@playwright/test";

const profile = process.env.CANDYBOX_TEST_PROFILE === "production"
  ? "production"
  : "development";

async function holdKey(page: Page, key: string, milliseconds: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(milliseconds);
  await page.keyboard.up(key);
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
  await page.evaluate(() => document.fonts.ready);
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
  const canvas = page.locator("canvas");
  const initialFrame = await canvas.screenshot();

  await holdKey(page, "ArrowRight", 500);
  const movedFrame = await canvas.screenshot();
  expect(movedFrame.equals(initialFrame)).toBe(false);

  await holdKey(page, "ArrowRight", 1_200);
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 1/1");
  await expect(page.locator("#game-status")).toHaveText("The first candy is yours.");

  await holdKey(page, "ArrowRight", 1_800);
  await expect(page.locator("#game-status")).toHaveText("The edge of the box holds firm.");

  await holdKey(page, "ArrowLeft", 900);
  await holdKey(page, "ArrowRight", 900);
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 1/1");
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
  await holdKey(page, "ArrowRight", 1_800);
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 1/1");

  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#candy-counter")).toHaveText("Candies: 0/1");
});
