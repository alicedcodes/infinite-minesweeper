import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    sortImports: true,
    sortPackageJson: {
      sortScripts: true,
    },
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "typescript/explicit-function-return-type": ["error", { allowExpressions: false }],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: { typeAware: true, typeCheck: true },
  },
  base: "/infinite-minesweeper/",
});
