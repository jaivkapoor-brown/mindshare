import { expect, type Page } from "@playwright/test";

export async function phaseOf(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __msPhase?: string }).__msPhase ?? "");
}

export async function waitPhase(page: Page, phase: string, timeout = 90_000) {
  await expect.poll(() => phaseOf(page), { timeout, intervals: [100] }).toBe(phase);
}

export async function home(page: Page, nick: string) {
  await page.goto("/");
  await page.getByLabel("Your nickname").fill(nick);
}

export async function noHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}
