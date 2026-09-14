import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { annoteer: fileURLToPath(new URL("../src/index.ts", import.meta.url)) } },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
