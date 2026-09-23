import * as fs from "node:fs/promises";
import path from "node:path";

/**
 * @typedef {Object} ThemeConfig
 * @property {string} name
 * @property {string} border
 * @property {[(n: number) => string, (n: number) => string]} safe
 * @property {[string, string]} flag
 * @property {[string, string]} mine
 * @property {string} can
 * @property {string} cant
 */

const OUTPUT_DIR = path.resolve("src", "assets");
const THEMES_PATH = path.join(OUTPUT_DIR, "themes.json");

/** @type {ThemeConfig[]} */
const themeConfigs = [
  {
    name: "Default",
    border: "oklch(0.2 0 0)",
    safe: [(n) => `oklch(0.8 0.35 ${((360 / 8) * Math.max(1, n)) % 360})`, () => "#000"],
    flag: ["oklch(0.9 0 0)", "#000"],
    mine: ["oklch(0.9 0 0)", "#000"],
    can: "oklch(0.3 0 0)",
    cant: "oklch(0.3 0 0 / 0.3)",
  },
];

async function generateThemes() {
  const themeData = themeConfigs.map((config) => {
    const tileBgs = Array.from({ length: 9 }, (_, n) => [`TILE_${n}_BG`, config.safe[0](n)]);
    const tileTxs = Array.from({ length: 9 }, (_, n) => [`TILE_${n}_TX`, config.safe[1](n)]);

    return {
      name: config.name,
      BORDER: config.border,
      ...Object.fromEntries(tileBgs),
      ...Object.fromEntries(tileTxs),
      FLAG_BG: config.flag[0],
      FLAG_TX: config.flag[1],
      MINE_BG: config.mine[0],
      MINE_TX: config.mine[1],
      CAN: config.can,
      CANT: config.cant,
    };
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(THEMES_PATH, JSON.stringify(themeData, null, 2), "utf-8");
}

generateThemes().catch(console.error);
