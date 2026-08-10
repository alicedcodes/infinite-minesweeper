function oklch(l: number, c: number, h: number, alpha: number = 1): string {
  return `oklch(${l * 100}% ${c} ${h} / ${alpha})`;
}

export const CONSTANTS = {
  TILE_HIDDEN: 0,
  TILE_REVEALED: 1,
  TILE_FLAGGED: 2,

  DEFAULT_DENSITY: 0.2,

  NEIGHBOR_OFFSETS: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],

  CANVAS_ID: "IMS",
  TILE_SIZE: 100,
  GROUP_SIZE: 5,
  GROUP_GAP: 20,
  ANIMATION_DURATION: 100,

  DRAG_THRESHOLD: 10,
  MIN_ZOOM: 1 / 32,
  MAX_ZOOM: 2,
  LOW_DETAIL_THRESHOLD: 1 / 8,
  ZOOM_SENSITIVITY: 0.0005,

  FONT_FAMILY: '"Noto Emoji", system-ui, -apple-system, sans-serif',
  COLOURS: {
    BG: oklch(0, 0, 0, 0.2),
    BG_FLAG: oklch(0.9, 0.3, 75),
    BG_MINE: oklch(0.9, 0.3, 30),
    BG_0: oklch(0.95, 0, 0),
    BG_0: oklch(0.95, 0.025, 90),
    BG_1: oklch(0.95, 0.025, 90),
    BG_2: oklch(0.95, 0.025, 150),
    BG_3: oklch(0.95, 0.025, 210),
    BG_4: oklch(0.95, 0.025, 270),
    BG_5: oklch(0.95, 0.025, 330),
    BG_6: oklch(0.95, 0.025, 30),
    BG_7: oklch(0.95, 0, 0),
    BG_8: oklch(0.15, 0, 0),

    TX: oklch(1, 0, 0),
    TX_1: oklch(0.7, 0.3, 90),
    TX_2: oklch(0.7, 0.3, 150),
    TX_3: oklch(0.7, 0.3, 210),
    TX_4: oklch(0.7, 0.3, 270),
    TX_5: oklch(0.7, 0.3, 330),
    TX_6: oklch(0.7, 0.3, 30),
    TX_7: oklch(1, 0, 0),
    TX_8: oklch(0, 0, 0),

    BD: oklch(0, 0, 0, 0.2),
  },

  DB_NAME: "Infinite Minesweeper",
  DB_VERSION: 1,
  TILE_STORE: "tileStore",
  META_STORE: "metaStore",
} as const;
