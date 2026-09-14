import { defineConfig } from "vite-plus";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], testTimeout: 15000 },
  lint: { ignorePatterns: ["packages/annoteer/template/**", "**/dist/**"] },
});
