export const SAFE_RADIUS = 2;

export const TILE_WORLD_SIZE = 100;
export const BASE_CHUNK_TILES = 16;
export const BASE_CHUNK_WORLD = TILE_WORLD_SIZE * BASE_CHUNK_TILES;

export const BITMAP_RES = 512;
export const TARGET_SCREEN_PX = 384;

export const MIN_LEVEL = -Math.log2(BASE_CHUNK_TILES);
export const MAX_LEVEL = 12;

export const MAX_CACHED_CHUNKS = 320;
export const VIEWPORT_PADDING_CHUNKS = 2;
export const SWEEPER_INTERVAL_MS = 3000;

export const MIN_ZOOM = 0.0625;
export const MAX_ZOOM = 2;

export const PAN_THRESHOLD = 10;
export const WHEEL_ZOOM_SPEED = 0.001;
export const TOUCHPAD_ZOOM_SPEED = 0.005;
