import { expect, test, type Page } from "@playwright/test";
import { waitPhase } from "./helpers";

async function tabTo(page: Page, match: RegExp, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return (el?.getAttribute("aria-label") || el?.textContent || "").trim();
    });
    if (match.test(label)) return;
  }
  throw new Error(`could not tab to ${match}`);
}

test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

test("keyboard only: start a solo game, ack, write, trade; focus ring visible", async ({ page }) => {
  await page.goto("/");
  await tabTo(page, /^$/); // nickname input has no text content
  await page.keyboard.type("Keys");
  await tabTo(page, /Play solo with bots/);
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(ring).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.locator(".player")).toHaveCount(4);
  await tabTo(page, /^Start game$/);
  await page.keyboard.press("Enter");
  await waitPhase(page, "CLUE", 15_000);
  await page.keyboard.press("Enter"); // "Got it" is focused
  await waitPhase(page, "WRITE", 15_000);
  await page.keyboard.type("a keyboard shaped like a dog");
  await page.keyboard.press("Enter");
  await waitPhase(page, "MARKET", 40_000);
  await tabTo(page, /^Buy one share of B/);
  await page.keyboard.press("Enter");
  await expect(page.locator(".tk.held")).toHaveCount(1);
  await page.keyboard.press("Shift+Enter"); // shift = 5 shares
  await expect(page.locator(".tk.held .held-n")).toHaveText("you hold 6");
});
