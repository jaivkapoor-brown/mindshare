import { expect, test } from "@playwright/test";
import { home, waitPhase } from "./helpers";

test("solo: one phone plays a full game with bots to the share card, board updates", async ({ page, browser }) => {
  await home(page, "Solo");
  await page.getByRole("button", { name: "Play solo with bots" }).click();
  await expect(page.locator(".player")).toHaveCount(4);
  const code = (await page.locator(".bigcode").textContent())!;
  await page.getByRole("radio", { name: "3" }).click();

  const boardCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const board = await boardCtx.newPage();
  await board.goto(`/board/${code}`);
  await expect(board.locator(".bcode")).toHaveText(code);

  await page.getByRole("button", { name: "Start game" }).click();
  for (let round = 1; round <= 3; round++) {
    await waitPhase(page, "CLUE", 20_000);
    await page.getByRole("button", { name: "Got it" }).click();
    await waitPhase(page, "WRITE", 15_000);
    await page.getByLabel("Your answer").fill(`round ${round}: a dog eating cheese in space`);
    await page.getByRole("button", { name: "Submit" }).click();
    await waitPhase(page, "MARKET", 40_000);
    if (round === 1) {
      await expect(board.locator(".btk").first()).toBeVisible();
      const before = await board.locator(".btk .p").allTextContents();
      await page.locator(".tradebtn.buy").first().click();
      await page.locator(".tradebtn.buy").first().click();
      await expect.poll(async () => (await board.locator(".btk .p").allTextContents()).join(), { timeout: 10_000 }).not.toBe(before.join());
    } else {
      await page.locator(".tradebtn.buy").nth(round % 3).click();
    }
    await waitPhase(page, "REVEAL", 75_000);
    await expect(page.getByText("✓ verified")).toBeVisible();
    if (round < 3) {
      await page.getByRole("button", { name: "Scores" }).click();
      await waitPhase(page, "SCOREBOARD", 5_000);
      await page.getByRole("button", { name: "Next round" }).click();
    } else {
      await page.getByRole("button", { name: "Scores" }).click();
      await page.getByRole("button", { name: "Final results" }).click();
    }
  }
  await waitPhase(page, "GAME_OVER", 15_000);
  await expect(page.locator(".standings li")).toHaveCount(4);
  const download = page.waitForEvent("download", { timeout: 10_000 }).catch(() => null);
  await page.getByRole("button", { name: "Share card" }).click();
  const d = await download;
  expect(d === null || d.suggestedFilename() === "mindshare.png").toBe(true);
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  await boardCtx.close();
});
