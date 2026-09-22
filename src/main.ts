import "./style.css";
import {
  TARGET_SCREEN_PX,
  BASE_CHUNK_WORLD,
  MIN_LEVEL,
  MAX_LEVEL,
  BITMAP_RES,
  TILE_WORLD_SIZE,
  MAX_CACHED_CHUNKS,
  VIEWPORT_PADDING_CHUNKS,
  SWEEPER_INTERVAL_MS,
  PAN_THRESHOLD,
  MIN_ZOOM,
  MAX_ZOOM,
  WHEEL_ZOOM_SPEED,
  SAFE_RADIUS,
  TOUCHPAD_ZOOM_SPEED,
  TILE_FLAGGED,
  TILE_HIDDEN,
  TILE_REVEALED,
  DRAW_DETAILS_START,
  BORDER_RADIUS_FRACTION,
  BORDER_WIDTH_FRACTION,
} from "./constants";

type TileState = 0 | 1 | 2;

type ChunkKey = `${number}:${number}:${number}`;

interface ChunkEntry {
  level: number;
  cx: number;
  cy: number;
  bitmap: ImageBitmap;
}

const canvas = document.querySelector<HTMLCanvasElement>("#app")!;
if (!canvas) throw new Error("Could not get #app element.");
const ctx = canvas.getContext("2d", { alpha: false })!;
if (!ctx) throw new Error("Browser does not support canvas.");

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

const tileStates = new Map<number, TileState>();
let seed = randomSeed();
let mineDensity = 0.2;
let started = false;
let startX = 0;
let startY = 0;

function packTileKey(x: number, y: number): number {
  return ((x & 0xffff) << 16) | (y & 0xffff);
}

function getTile(x: number, y: number): TileState {
  return tileStates.get(packTileKey(x, y)) ?? TILE_HIDDEN;
}

function setTile(x: number, y: number, state: TileState): void {
  const key = packTileKey(x, y);
  if (state === TILE_HIDDEN) tileStates.delete(key);
  else tileStates.set(key, state);
}

function hash2D(x: number, y: number): number {
  let h = seed ^ Math.imul(y, 73856093) ^ Math.imul(x, 19349663);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

function hasMine(x: number, y: number): boolean {
  if (started && Math.abs(x - startX) <= SAFE_RADIUS && Math.abs(y - startY) <= SAFE_RADIUS)
    return false;
  return hash2D(x, y) < mineDensity * 4294967296;
}

let canvasWidth = 0;
let canvasHeight = 0;

let dirty = true;

let zoom = 1;
let camX = 0;
let camY = 0;

function pickLevel(): number {
  const raw = Math.log2(TARGET_SCREEN_PX / (BASE_CHUNK_WORLD * zoom));
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(raw)));
}

function chunkWorldSize(level: number): number {
  return BASE_CHUNK_WORLD * 2 ** level;
}

function packKey(level: number, cx: number, cy: number): ChunkKey {
  return `${level}:${cx}:${cy}`;
}

const scratch = new OffscreenCanvas(BITMAP_RES, BITMAP_RES);
const scratchCtx = scratch.getContext("2d")!;

function renderChunk(level: number, cx: number, cy: number): ImageBitmap {
  const worldSize = chunkWorldSize(level);
  const tilesPerSize = worldSize / TILE_WORLD_SIZE;

  const baseTileX = Math.floor((cx * worldSize) / TILE_WORLD_SIZE);
  const baseTileY = Math.floor((cy * worldSize) / TILE_WORLD_SIZE);

  const px = BITMAP_RES / tilesPerSize;
  const drawDetails = px >= DRAW_DETAILS_START;
  const borderWidth = Math.max(1, Math.round(px / BORDER_WIDTH_FRACTION));
  const borderRadius = Math.max(1, Math.round(px / BORDER_RADIUS_FRACTION));

  scratchCtx.fillStyle = "#000";
  scratchCtx.fillRect(0, 0, BITMAP_RES, BITMAP_RES);

  for (let ly = 0; ly < tilesPerSize; ly++) {
    const y = baseTileY + ly;
    const py0 = Math.round(ly * px);
    const py1 = Math.round((ly + 1) * px);

    for (let lx = 0; lx < tilesPerSize; lx++) {
      const x = baseTileX + lx;
      const px0 = Math.round(lx * px);
      const px1 = Math.round((lx + 1) * px);

      const state = getTile(x, y);
      const mine = state === TILE_REVEALED && hasMine(x, y);

      if (state === TILE_HIDDEN) scratchCtx.fillStyle = "#303030";
      else if (state === TILE_FLAGGED) scratchCtx.fillStyle = "#306030";
      else scratchCtx.fillStyle = mine ? "#803030" : "#505050";

      if (drawDetails) {
        scratchCtx.beginPath();
        scratchCtx.roundRect(
          px0 + borderWidth,
          py0 + borderWidth,
          px1 - px0 - borderWidth * 2,
          py1 - py0 - borderWidth * 2,
          borderRadius,
        );
        scratchCtx.fill();

        const icon = state === TILE_FLAGGED ? "🚩" : mine ? "💥" : null;
        if (icon) {
          scratchCtx.font = `${Math.round(px * 0.55)}px sans-serif`;
          scratchCtx.textAlign = "center";
          scratchCtx.textBaseline = "middle";
          scratchCtx.fillText(icon, px0 + px / 2, py0 + px / 2);
        }
      } else {
        scratchCtx.fillRect(px0, py0, px1 - px0, py1 - py0);
      }
    }
  }

  return scratch.transferToImageBitmap();
}

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

  const bitmap = renderChunk(level, cx, cy);
  chunkCache.set(key, { level, cx, cy, bitmap });
  return bitmap;
}

function invalidateTile(x: number, y: number): void {
  for (const key of Array.from(chunkCache.keys())) {
    const entry = chunkCache.get(key);
    if (!entry) continue;

    const worldSize = chunkWorldSize(entry.level);
    const tileSpan = worldSize / TILE_WORLD_SIZE;
    const baseTileX = Math.floor((entry.cx * worldSize) / TILE_WORLD_SIZE);
    const baseTileY = Math.floor((entry.cy * worldSize) / TILE_WORLD_SIZE);

    const lx = x - baseTileX;
    const ly = y - baseTileY;
    if (lx >= 0 && lx < tileSpan && ly >= 0 && ly < tileSpan) {
      disposeChunk(key);
    }
  }
}

function computeChunkRange(padding = 0): {
  level: number;
  startCX: number;
  endCX: number;
  startCY: number;
  endCY: number;
} {
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
      const screenX = Math.round((cx * worldSize - worldLeft) * zoom);
      const bitmap = getChunk(range.level, cx, cy);
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
    draw();
    dirty = false;
  }

  requestAnimationFrame(tick);
}

function handleTileClick(x: number, y: number, reveal: boolean): void {
  if (BITMAP_RES / (chunkWorldSize(pickLevel()) / TILE_WORLD_SIZE) < DRAW_DETAILS_START) return;

  const state = getTile(x, y);

  if (reveal) {
    if (state !== TILE_HIDDEN) return;
    if (!started) {
      started = true;
      startX = x;
      startY = y;
    }
    setTile(x, y, TILE_REVEALED);
  } else if (started) {
    if (state === TILE_HIDDEN) setTile(x, y, TILE_FLAGGED);
    else if (state === TILE_FLAGGED) setTile(x, y, TILE_HIDDEN);
    else return;
  }

  invalidateTile(x, y);
  dirty = true;
}

{
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

  const activePointers: PointerEvent[] = [];
  let panning = false;
  let initialX = 0;
  let initialY = 0;
  let dragX = 0;
  let dragY = 0;

  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
    activePointers.push(e);

    panning = false;

    if (activePointers.length === 1) {
      initialX = e.clientX;
      initialY = e.clientY;
      dragX = e.clientX + camX * zoom;
      dragY = e.clientY + camY * zoom;
    }
  });

  window.addEventListener("pointermove", (e) => {
    const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
    if (index !== -1) activePointers[index] = e;

    if (activePointers.length === 1) {
      if (!panning && Math.hypot(e.clientX - initialX, e.clientY - initialY) >= PAN_THRESHOLD) {
        panning = true;
        if (started) {
          canvas.style.cursor = "grabbing";
        }
      }

      if (panning && started) {
        camX = (dragX - e.clientX) / zoom;
        camY = (dragY - e.clientY) / zoom;
        dirty = true;
      }
    }
  });

  function handlePointerUp(e: PointerEvent): void {
    const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
    if (index !== -1) activePointers.splice(index, 1);

    if (!panning) {
      const rect = canvas.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;

      const worldX = camX + (mouseScreenX - canvasWidth / 2) / zoom;
      const worldY = camY + (mouseScreenY - canvasHeight / 2) / zoom;

      const x = Math.floor(worldX / TILE_WORLD_SIZE);
      const y = Math.floor(worldY / TILE_WORLD_SIZE);

      handleTileClick(x, y, e.button === 0);
    }

    panning = false;
    canvas.style.cursor = "default";
  }

  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("pointercancel", handlePointerUp);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function updateZoom(targetZoom: number, clientX: number, clientY: number): void {
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
    if (zoom === newZoom) return;

    if (started) {
      const rect = canvas.getBoundingClientRect();
      const mouseScreenX = clientX - rect.left;
      const mouseScreenY = clientY - rect.top;

      const offsetX = mouseScreenX - canvasWidth / 2;
      const offsetY = mouseScreenY - canvasHeight / 2;

      const worldX = offsetX / zoom + camX;
      const worldY = offsetY / zoom + camY;

      camX = worldX - offsetX / newZoom;
      camY = worldY - offsetY / newZoom;
    }

    zoom = newZoom;

    dirty = true;
  }

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const mod = e.ctrlKey ? TOUCHPAD_ZOOM_SPEED : WHEEL_ZOOM_SPEED;
      updateZoom(zoom * Math.exp(-e.deltaY * mod), e.clientX, e.clientY);
    },
    { passive: false },
  );
}

requestAnimationFrame(tick);
