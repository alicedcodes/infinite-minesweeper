// @ts-check

import fs from "node:fs";
import path from "node:path";
import favicons from "favicons";

const source = path.join(import.meta.dirname, "../public/favicon.svg");
const outDir = path.join(import.meta.dirname, "../public/icons");

fs.mkdirSync(outDir, { recursive: true });

/** @type {import("favicons").FaviconOptions} */
const config = {
  icons: {
    android: ["android-chrome-192x192.png", "android-chrome-512x512.png"],
    appleIcon: ["apple-touch-icon.png"],
    appleStartup: false,
    favicons: ["favicon.ico", "favicon-32x32.png"],
    windows: false,
    yandex: false,
  },
};

const response = await favicons(source, config);

response.images.forEach((image) => {
  fs.writeFileSync(path.join(outDir, image.name), image.contents);
});
