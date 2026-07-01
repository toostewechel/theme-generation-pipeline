import { test, expect } from "@playwright/test";

test("first slider reaches its max when End is pressed", async ({ page }) => {
  await page.goto("/");
  const slider = page.getByRole("slider").first();
  await expect(slider).toBeVisible();
  await slider.focus();
  await slider.press("End");
  await page.waitForTimeout(100);
  // The neutral Hue slider max is 360.
  await expect(slider).toHaveAttribute("aria-valuenow", "360");
});
