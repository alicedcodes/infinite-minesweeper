import { defineConfig } from "vite-plus";

export default defineConfig({
  base: "/infinite-minesweeper/",
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: { typeAware: true, typeCheck: true },
    rules: {
      "object-shorthand": "error",
      "sort-keys": ["error", "asc", { natural: true }],
      "typescript/explicit-function-return-type": "error",
      "typescript/explicit-member-accessibility": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
