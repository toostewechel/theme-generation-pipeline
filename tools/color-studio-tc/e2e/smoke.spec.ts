import { test, expect } from "@playwright/test";

test("panel and slider render styled", async ({ page }) => {
  await page.goto("/");

  // Toolcraft panel surface has a non-transparent background once themed.
  const panelTitle = page.getByText("Smoke Test");
  await expect(panelTitle).toBeVisible();

  // The slider primitive exposes role=slider.
  await expect(page.getByRole("slider").first()).toBeVisible();
});

test("panel surface has themed background (not transparent)", async ({ page }) => {
  await page.goto("/");

  // Wait for the panel title to confirm the app has rendered.
  await expect(page.getByText("Smoke Test")).toBeVisible();

  // Check that body has the light background color (--background: oklch(1 0 0) = white).
  // Chromium may return the color in oklch or rgb depending on version.
  const bodyBg = await page.evaluate(() =>
    window.getComputedStyle(document.body).backgroundColor
  );
  // oklch(1 0 0) is white; accept both oklch and rgb representations.
  const isWhite =
    bodyBg === "rgb(255, 255, 255)" ||
    bodyBg.startsWith("oklch(1 ") ||
    bodyBg === "oklch(1 0 0)";
  expect(isWhite, `body background should be white, got: ${bodyBg}`).toBe(true);

  // Check the panel surface: it uses .toolcraft-panel-surface which inherits from --popover.
  // At minimum, it should not be "transparent" or "rgba(0, 0, 0, 0)".
  const panelEl = page.locator(".toolcraft-panel-surface").first();
  const panelBg = await panelEl.evaluate((el) =>
    window.getComputedStyle(el).backgroundColor
  );
  // oklch(1 0 0) = rgb(255, 255, 255), or color-mix result — either way not transparent
  expect(panelBg).not.toBe("rgba(0, 0, 0, 0)");
  expect(panelBg).not.toBe("transparent");

  // Take a light-mode screenshot.
  await page.screenshot({ path: "test-results/smoke-light.png", fullPage: true });
});

test("dark mode changes body background", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Smoke Test")).toBeVisible();

  // Record light background first.
  const lightBg = await page.evaluate(() =>
    window.getComputedStyle(document.body).backgroundColor
  );

  // Toggle dark mode.
  await page.evaluate(() => document.documentElement.classList.add("dark"));

  // Wait a tick for paint.
  await page.waitForTimeout(100);

  const darkBg = await page.evaluate(() =>
    window.getComputedStyle(document.body).backgroundColor
  );

  // Dark background (--background: oklch(0.145 0 0)) should differ from white.
  expect(darkBg).not.toBe(lightBg);
  // Should be a dark color, definitely not white.
  expect(darkBg).not.toBe("rgb(255, 255, 255)");

  // Take a dark-mode screenshot.
  await page.screenshot({ path: "test-results/smoke-dark.png", fullPage: true });
});
