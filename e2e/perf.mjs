// First paint on a throttled 4G profile. Usage: node e2e/perf.mjs [url]
import { chromium } from "@playwright/test";
const url = process.argv[2] ?? "https://server.jai-v-kapoor.workers.dev/";
const browser = await chromium.launch();
const runs = [];
for (let i = 0; i < 3; i++) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  // "Fast 4G"-ish: 150 ms RTT, 9 Mbps down, 1.5 Mbps up
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(url, { waitUntil: "load" });
  await page.getByText("Play solo with bots").waitFor();
  const t = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1;
    const fp = performance.getEntriesByName("first-paint")[0]?.startTime ?? -1;
    return { fp: Math.round(fp), fcp: Math.round(fcp) };
  });
  runs.push(t);
  await ctx.close();
}
console.log(JSON.stringify(runs));
await browser.close();
