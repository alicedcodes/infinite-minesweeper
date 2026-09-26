export const TILE_HIDDEN = 0;
export const TILE_REVEALED = 1;
export const TILE_FLAGGED = 2;

export const NEIGHBOUR_OFFSETS: [number, number][] = [
  [-1, 0], // N
  [0, 1], // E
  [1, 0], // S
  [0, -1], // W

  [-1, -1], // NW
  [-1, 1], // NE
  [1, 1], // SE
  [1, -1], // SW
];

export const FINISHED_BIT = 0b1;
export const CAN_INTERACT_BIT = 0b1 << 1;
export const NEARBY_MINES_MASK = 0b1111 << 2;

export const DEFAULT_DENSITY = 0.2;

export const SAFE_RADIUS = 2;

export const TILE_WORLD_SIZE = 100;
export const BASE_CHUNK_TILES = 16;
export const BASE_CHUNK_WORLD = TILE_WORLD_SIZE * BASE_CHUNK_TILES;

export const BITMAP_RES = 512;
export const TARGET_SCREEN_PX = 384;

export const DRAW_DETAILS_START = 24;

export const FONT_FAMILY = 'Arial, Helvetica, sans-serif, "Noto Emoji Variable"';
export const FONT_SIZE = 0.64;

export const BORDER_WIDTH_FRACTION = 24;
export const BORDER_RADIUS_FRACTION = 12;

export const MIN_LEVEL = -Math.log2(BASE_CHUNK_TILES);
export const MAX_LEVEL = 12;

export const MAX_CACHED_CHUNKS = 320;
export const VIEWPORT_PADDING_CHUNKS = 2;
export const SWEEPER_INTERVAL_MS = 3000;

export const TILES_PER_TICK = 200;
export const ANIMATION_DELAY = 50;
export const ANIMATION_DURATION = 150;

export const MIN_ZOOM = 0.0625;
export const MAX_ZOOM = 2;

export const PAN_THRESHOLD = 10;
export const WHEEL_ZOOM_SPEED = 0.001;
export const TOUCHPAD_ZOOM_SPEED = 0.005;
export const LONG_PRESS_DURATION = 350;

export const RESET_TIMEOUT_MS = 5000;

export const LOCAL_STORAGE_KEY = "infinite-minesweeper";

export const DB_NAME = "Infinite Minesweeper";
export const DB_VERSION = 1;
export const DB_STORE = "tileStore";
