import { defineConfig } from "vitest/config";

// Prompt templates in /prompts are plain markdown; load them as strings like wrangler's Text rule does.
const mdText = {
  name: "md-text",
  transform(code: string, id: string) {
    if (id.endsWith(".md")) return { code: `export default ${JSON.stringify(code)};`, map: null };
  },
};

export default defineConfig({
  plugins: [mdText],
  test: {
    include: ["shared/test/**/*.test.ts", "server/test/**/*.test.ts", "client/test/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
  },
});
