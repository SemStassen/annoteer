import { defineConfig } from "vite-plus";
export default defineConfig({
  pack: [
    {
      entry: ["src/index.ts"],
      format: "esm",
      clean: false,
      platform: "browser",
      dts: true,
      sourcemap: true,
      outDir: "dist",
      deps: { neverBundle: ["react", "react-dom", "react/jsx-runtime"] },
    },
    {
      entry: ["../cli/src/index.ts"],
      format: "esm",
      clean: false,
      platform: "node",
      outDir: "dist/cli",
      dts: false,
      sourcemap: true,
    },
    {
      entry: ["../worker/src/index.ts"],
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
