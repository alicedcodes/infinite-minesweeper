import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#app")!;
if (!canvas) throw new Error("Could not get #app element.");
const ctx = canvas.getContext("2d", { alpha: false })!;
if (!ctx) throw new Error("Browser does not support canvas.");

let canvasWidth = 0;
let canvasHeight = 0;

let dirty = true;

let zoom = 1;
let camX = 0;
let camY = 0;

const TILE_WORLD_SIZE = 100;
const BASE_CHUNK_TILES = 16;
const BASE_CHUNK_WORLD = TILE_WORLD_SIZE * BASE_CHUNK_TILES;

const BITMAP_RES = 512;
const TARGET_SCREEN_PX = 384;

const MIN_LEVEL = -Math.log2(BASE_CHUNK_TILES);
const MAX_LEVEL = 12;

function pickLevel(): number {
  const raw = Math.log2(TARGET_SCREEN_PX / (BASE_CHUNK_WORLD * zoom));
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(raw)));
}

function chunkWorldSize(level: number): number {
  return BASE_CHUNK_WORLD * 2 ** level;
}

type ChunkKey = `${number}:${number}:${number}`;

function packKey(level: number, cx: number, cy: number): ChunkKey {
  return `${level}:${cx}:${cy}`;
}

const scratch = new OffscreenCanvas(BITMAP_RES, BITMAP_RES);
const scratchCtx = scratch.getContext("2d")!;

function renderChunk(level: number): ImageBitmap {
  const worldSize = chunkWorldSize(level);
  const tilesPerSize = worldSize / TILE_WORLD_SIZE;
  const px = BITMAP_RES / tilesPerSize;
  const drawDetails = px >= 16;

  const borderWidth = Math.max(1, Math.round(px / 12));
  const borderRadius = Math.max(1, Math.round(px / 12));

  scratchCtx.fillStyle = "#000";
  scratchCtx.fillRect(0, 0, BITMAP_RES, BITMAP_RES);

  for (let ly = 0; ly < tilesPerSize; ly++) {
    const py0 = Math.round(ly * px);
    const py1 = Math.round((ly + 1) * px);

    for (let lx = 0; lx < tilesPerSize; lx++) {
      const px0 = Math.round(lx * px);
      const px1 = Math.round((lx + 1) * px);

      scratchCtx.fillStyle = "#303030";
      if (drawDetails) {
        scratchCtx.beginPath();
        scratchCtx.roundRect(
          px0 + borderWidth,
          py0 + borderWidth,
          px1 - px0 - borderWidth,
          py1 - py0 - borderWidth,
          borderRadius,
        );
        scratchCtx.fill();
      } else {
        scratchCtx.fillRect(px0, py0, px1 - px0, py1 - py0);
      }
    }
  }

  return scratch.transferToImageBitmap();
}

interface ChunkEntry {
  level: number;
  cx: number;
  cy: number;
  bitmap: ImageBitmap;
}

const MAX_CACHED_CHUNKS = 320;
const VIEWPORT_PADDING_CHUNKS = 2;
const SWEEPER_INTERVAL_MS = 3000;

const chunkCache = new Map<ChunkKey, ChunkEntry>();
let lastSweep = 0;

function disposeChunk(key: ChunkKey): void {
  const entry = chunkCache.get(key);
  if (!entry) return;
  entry.bitmap.close();
  chunkCache.delete(key);
}

function getChunk(level: number, cx: number, cy: number): ImageBitmap {
  const key = packKey(level, cx, cy);
  const existing = chunkCache.get(key);
  if (existing) {
    chunkCache.delete(key);
    chunkCache.set(key, existing);
    return existing.bitmap;
  }

  if (chunkCache.size >= MAX_CACHED_CHUNKS) {
    const oldestKey = chunkCache.keys().next().value;
    if (oldestKey !== undefined) disposeChunk(oldestKey);
  }

  const bitmap = renderChunk(level);
  chunkCache.set(key, { level, cx, cy, bitmap });
  return bitmap;
}

interface ChunkRange {
  level: number;
  startCX: number;
  endCX: number;
  startCY: number;
  endCY: number;
}

function computeChunkRange(padding = 0): ChunkRange {
  const level = pickLevel();
  const worldSize = chunkWorldSize(level);

  const worldLeft = camX - canvasWidth / 2 / zoom;
  const worldTop = camY - canvasHeight / 2 / zoom;

  return {
    level,
    startCX: Math.floor(worldLeft / worldSize) - padding,
    endCX: Math.ceil((worldLeft + canvasWidth / zoom) / worldSize) + padding,
    startCY: Math.floor(worldTop / worldSize) - padding,
    endCY: Math.ceil((worldTop + canvasHeight / zoom) / worldSize) + padding,
  };
}

function sweepUnusedChunks(): void {
  const keep = computeChunkRange(VIEWPORT_PADDING_CHUNKS);
  const keepKeys = new Set<string>();
  for (let cy = keep.startCY; cy < keep.endCY; cy++) {
    for (let cx = keep.startCX; cx < keep.endCX; cx++) {
      keepKeys.add(packKey(keep.level, cx, cy));
    }
  }

  for (const key of Array.from(chunkCache.keys())) {
    if (!keepKeys.has(key)) disposeChunk(key);
  }
}

function draw(): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.imageSmoothingEnabled = false;

  const range = computeChunkRange();
  const worldSize = chunkWorldSize(range.level);
  const worldLeft = camX - canvasWidth / 2 / zoom;
  const worldTop = camY - canvasHeight / 2 / zoom;

  for (let cy = range.startCY; cy < range.endCY; cy++) {
    const screenY = Math.round((cy * worldSize - worldTop) * zoom);
    for (let cx = range.startCX; cx < range.endCX; cx++) {
      const bitmap = getChunk(range.level, cx, cy);
      const screenX = Math.round((cx * worldSize - worldLeft) * zoom);
      const size = Math.ceil(worldSize * zoom);
      ctx.drawImage(bitmap, screenX, screenY, size, size);
    }
  }
}

function tick(): void {
  const now = performance.now();

  if (now - lastSweep >= SWEEPER_INTERVAL_MS) {
    lastSweep = now;
    sweepUnusedChunks();
  }

  if (dirty) {
    console.log(zoom);
    draw();
    dirty = false;
  }

  requestAnimationFrame(tick);
}

const observer = new ResizeObserver((entries) => {
  const entry = entries[0]!;
  const { width, height } = entry.contentRect;

  canvas.width = width;
  canvas.height = height;
  canvasWidth = width;
  canvasHeight = height;

  dirty = true;
});
observer.observe(canvas);

requestAnimationFrame(tick);
