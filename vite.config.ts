import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, loadEnv } from "vite-plus";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const base = "/infinite-minesweeper/";
  const port = 64637; /* MINES */

  return {
    staged: {
      "*": "vp check --fix",
    },
    fmt: {
      sortImports: { newlinesBetween: false },
      sortPackageJson: { sortScripts: true },
    },
    lint: {
      jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
      rules: {
        "vite-plus/prefer-vite-plus-imports": "error",
        "typescript/explicit-member-accessibility": "error",
        "class-methods-use-this": "error",
      },
      options: { typeAware: true, typeCheck: true },
    },
    base,
    server: {
      port,
      strictPort: true,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "inline",
        manifest: {
          name: env.VITE_APP_TITLE,
          short_name: env.VITE_APP_SHORT,
          description: env.VITE_APP_DESC,
          display: "standalone",
          orientation: "any",
          icons: [
            {
              src: `${base}icons/android-chrome-192x192.png`,
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: `${base}icons/android-chrome-512x512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
      }),
    ],
  };
});
