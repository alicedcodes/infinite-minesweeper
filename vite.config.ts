import { defineConfig, loadEnv } from "vite-plus";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const base = "/infinite-minesweeper/";
  const port = 64637; /* MINES */

  return {
    base,
    server: {
      port,
      strictPort: true,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
    staged: { "*": "vp check --fix" },
    fmt: { sortPackageJson: { sortScripts: true } },
    lint: {
      jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
      rules: {
        "vite-plus/prefer-vite-plus-imports": "error",
        "typescript/explicit-function-return-type": ["error", { allowExpressions: true }],
      },
      options: { typeAware: true, typeCheck: true },
    },
  };
});
