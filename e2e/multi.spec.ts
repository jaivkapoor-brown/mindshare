import { expect, test } from "@playwright/test";
import { home, noHorizontalScroll, phaseOf, waitPhase } from "./helpers";

test("three phones: create, join, play one round in sync", async ({ browser }) => {
  const ctxs = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true })));
  const [a, b, c] = await Promise.all(ctxs.map((x) => x.newPage()));

  await home(a, "Alice");
  await a.getByRole("button", { name: "Create a room for friends" }).click();
  await expect(a.locator(".bigcode")).toHaveText(/^[A-Z]{4}$/);
  const code = (await a.locator(".bigcode").textContent())!;

  for (const [p, n] of [[b, "Bob"], [c, "Cleo"]] as const) {
    await home(p, n);
    await p.getByLabel("Room code").fill(code);
    await p.getByRole("button", { name: "Join", exact: true }).click();
    await expect(p.locator(".bigcode")).toHaveText(code);
  }
  for (const p of [a, b, c]) await expect(p.locator(".player")).toHaveCount(3);
  await noHorizontalScroll(a);

  await a.getByRole("button", { name: "Start game" }).click();
  for (const p of [a, b, c]) await waitPhase(p, "CLUE", 15_000);
  for (const p of [a, b, c]) await p.getByRole("button", { name: "Got it" }).click();
  for (const p of [a, b, c]) await waitPhase(p, "WRITE");

  const answers = ["a puppy in a raincoat", "a haunted fax machine", "soup for breakfast"];
  for (const [i, p] of [a, b, c].entries()) {
    await p.getByLabel("Your answer").fill(answers[i]);
    await p.keyboard.press("Enter");
  }
  for (const p of [a, b, c]) await waitPhase(p, "MARKET", 10_000);

  // all screens show the same phase within 500 ms
  const t0 = Date.now();
  const phases = await Promise.all([a, b, c].map(phaseOf));
  expect(new Set(phases).size).toBe(1);
  expect(Date.now() - t0).toBeLessThan(500);

  await expect(a.locator(".tk")).toHaveCount(5); // 3 answers + 2 decoys
  await noHorizontalScroll(a);
  const plus = a.locator(".tradebtn.buy").first();
  await plus.click();
  await expect(a.locator(".tk.held")).toHaveCount(1);
  await b.locator(".tradebtn.buy").nth(1).click();

  for (const p of [a, b, c]) await waitPhase(p, "VERDICT", 70_000);
  for (const p of [a, b, c]) await waitPhase(p, "REVEAL", 10_000);
  await expect(a.getByText("✓ verified")).toBeVisible();
  await expect(a.getByText("fallback judge")).toBeVisible();
  await noHorizontalScroll(a);
  for (const x of ctxs) await x.close();
});

test("reload keeps your seat", async ({ page }) => {
  await home(page, "Reloader");
  await page.getByRole("button", { name: "Play solo with bots" }).click();
  await expect(page.locator(".player")).toHaveCount(4);
  await page.reload();
  await expect(page.locator(".player")).toHaveCount(4);
  await expect(page.getByText("Reloader (you)")).toBeVisible();
});

test("unknown room shows a friendly message", async ({ page }) => {
  await home(page, "Lost");
  await page.getByLabel("Room code").fill("ZZZZ");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("No room with that code");
});
