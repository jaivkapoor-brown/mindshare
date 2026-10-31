import { expect, test } from "@playwright/test";

test("browser without WebSockets sees a one-line message, not a blank page", async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error simulate an old browser
    delete window.WebSocket;
  });
  await page.goto("/");
  await expect(page.getByText(/needs a browser with WebSockets/)).toBeVisible();
});

test("browser without localStorage sees a one-line message, not a blank page", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.goto("/");
  await expect(page.getByText(/needs local storage/)).toBeVisible();
});
