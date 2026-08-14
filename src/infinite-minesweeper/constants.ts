import { number2Colour } from "./utils";

export const VS15 = "\uFE0E";

export const TILE_HIDE = 0;
export const TILE_SHOW = 1;
export const TILE_FLAG = 2;

export const NEIGHBOUR_OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export const DEFAULT_DENSITY = 0.2;
export const CANVAS_ID = "gameCanvas";

export const TILE_SIZE = 100;
export const BORDER_WIDTH = 2;
export const BORDER_RADIUS = 4;

export const MIN_ZOOM = 1 / 16;
export const MAX_ZOOM = 2;
export const LOW_DETAIL_ZOOM = 1 / 6;
export const PAN_THRESHOLD = 10;
export const WHEEL_ZOOM_SPEED = 0.001;
export const LONG_PRESS_DURATION = 350;

export const FONT_SIZE = 48;
export const FONT_FAMILY = "Arial, Helvetica, sans-serif, 'Noto Emoji Variable'";

export const THEME = {
  TILE: "oklch(0.5 0 0)",
  BORDER: "oklch(0.2 0 0)",
  TEXT: "oklch(1 0 0)",
  TEXT_DARK: "oklch(0 0 0)",

  NUMBER_1: /* @__PURE__ */ number2Colour(1),
  NUMBER_2: /* @__PURE__ */ number2Colour(2),
  NUMBER_3: /* @__PURE__ */ number2Colour(3),
  NUMBER_4: /* @__PURE__ */ number2Colour(4),
  NUMBER_5: /* @__PURE__ */ number2Colour(5),
  NUMBER_6: /* @__PURE__ */ number2Colour(6),
  NUMBER_7: /* @__PURE__ */ number2Colour(7),
  NUMBER_8: /* @__PURE__ */ number2Colour(8),
} as const;

export const ANIMATION_DURATION = 100;
export const ANIMATION_DELAY = 20;

export const DB_NAME = "Infinite Minesweeper";
export const DB_VERSION = 1;
export const DB_STORE = "tileStore";

export const CAMERA_KEY = "cam";
export const ZOOM_KEY = "zoom";
export const THEME_KEY = "theme";
