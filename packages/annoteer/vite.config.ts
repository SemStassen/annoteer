import { defineConfig } from "vite-plus";
export default defineConfig({
  pack: [
    {
      entry: ["src/react/index.ts"],
      format: "esm",
      clean: false,
      platform: "browser",
      dts: true,
      sourcemap: true,
      outDir: "dist",
      deps: { neverBundle: ["react", "react-dom", "react/jsx-runtime"] },
    },
    {
      entry: ["src/cli/index.ts"],
      outExtensions: () => ({ js: ".mjs" }),
      format: "esm",
      clean: false,
      platform: "node",
      outDir: "dist/cli",
      dts: false,
      sourcemap: true,
    },
    {
      entry: ["src/server/index.ts"],
      format: "esm",
      clean: false,
      platform: "browser",
      outDir: "template/worker",
      dts: false,
      deps: { alwaysBundle: ["effect"], onlyBundle: ["effect"] },
      sourcemap: true,
    },
  ],
});
