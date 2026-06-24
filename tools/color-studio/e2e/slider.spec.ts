import { test, expect } from "playwright/test";

test("slider thumb moves when value changes — track-rail width regression", async ({ page }) => {
  await page.goto("/");

  // The first slider in the Foundation section is the neutral Hue slider.
  // Slider.Thumb renders as a div.thumb containing an input[role="slider"].
  const thumb = page.locator(".thumb").first();
  const sliderInput = page.getByRole("slider").first();

  // Wait for the thumb to be visible and stable.
  await expect(thumb).toBeVisible();

  // Capture the thumb's position BEFORE pressing End.
  const before = await thumb.boundingBox();
  expect(before).not.toBeNull();

  // Focus the slider input and press End to jump to maximum value.
  await sliderInput.focus();
  await sliderInput.press("End");

  // Give the DOM one frame to settle.
  await page.waitForTimeout(100);

  // Capture the thumb's position AFTER pressing End.
  const after = await thumb.boundingBox();
  expect(after).not.toBeNull();

  // The thumb must have moved significantly to the right.
  // With the zero-width-Track bug, after.x === before.x (thumb stays pinned at left).
  // With the fix (.track-rail { width: 100% }), after.x is near the right edge of the track.
  expect(after!.x).toBeGreaterThan(before!.x + 20);
});
