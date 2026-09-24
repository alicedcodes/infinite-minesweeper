import "./style.css";
import THEMES from "./assets/themes.json" with { type: "json" };
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
  NEIGHBOUR_OFFSETS,
  FINISHED_BIT,
  NEARBY_MINES_MASK,
  FONT_SIZE,
  FONT_FAMILY,
  CAN_INTERACT_BIT,
  RESET_TIMEOUT_MS,
  ANIMATION_DELAY,
  ANIMATION_DURATION,
  LONG_PRESS_DURATION,
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
// TODO: Manage metaDataCache memory (e.g., removing old meta data)
const metaDataCache = new Map<number, number>();
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
  metaDataCache.delete(key);
  invalidateTile(x, y);

  for (const [ox, oy] of NEIGHBOUR_OFFSETS) {
    const nx = x + ox;
    const ny = y + oy;
    metaDataCache.delete(packTileKey(nx, ny));
    invalidateTile(nx, ny);
  }
}

function hash2D(x: number, y: number): number {
  let h = seed ^ Math.imul(y, 73856093) ^ Math.imul(x, 19349663);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

function hasMine(x: number, y: number): boolean {
  return started && Math.abs(x - startX) <= SAFE_RADIUS && Math.abs(y - startY) <= SAFE_RADIUS
    ? false
    : hash2D(x, y) < mineDensity * 4294967296;
}

function getTileMetaData(x: number, y: number): number {
  const key = packTileKey(x, y);
  const cached = metaDataCache.get(key);
  if (cached !== undefined) return cached;

  let nearbyMines = 0;
  let guessedMines = 0;
  let canInteract = false;

  for (const [ox, oy] of NEIGHBOUR_OFFSETS) {
    const [nx, ny] = [x + ox, y + oy];
    const state = getTile(nx, ny);

    if (hasMine(nx, ny)) {
      nearbyMines++;
      if (state === TILE_REVEALED) guessedMines++;
    }
    if (state === TILE_FLAGGED) guessedMines++;
    if (state === TILE_REVEALED) canInteract = true;
  }

  const data =
    (nearbyMines << 2) |
    (canInteract ? CAN_INTERACT_BIT : 0) |
    (guessedMines === nearbyMines ? FINISHED_BIT : 0);

  metaDataCache.set(key, data);
  return data;
}

function isFinished(data: number): boolean {
  return (data & FINISHED_BIT) === FINISHED_BIT;
}

function getCanInteract(data: number): boolean {
  return (data & CAN_INTERACT_BIT) === CAN_INTERACT_BIT;
}

function getNearbyMines(data: number): number {
  return (data & NEARBY_MINES_MASK) >> 2;
}

let canvasWidth = 0;
let canvasHeight = 0;

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

let themeIndex = 0;

function renderChunk(level: number, cx: number, cy: number, now: number): ImageBitmap {
  const worldSize = chunkWorldSize(level);
  const tilesPerSize = worldSize / TILE_WORLD_SIZE;

  const baseTileX = Math.floor((cx * worldSize) / TILE_WORLD_SIZE);
  const baseTileY = Math.floor((cy * worldSize) / TILE_WORLD_SIZE);

  const px = BITMAP_RES / tilesPerSize;
  const drawDetails = px >= DRAW_DETAILS_START;
  const borderWidth = Math.max(1, Math.round(px / BORDER_WIDTH_FRACTION));
  const borderRadius = Math.max(1, Math.round(px / BORDER_RADIUS_FRACTION));

  const t = THEMES[themeIndex] ?? THEMES[0]!;

  scratchCtx.font = `bold ${Math.round(px * FONT_SIZE)}px ${FONT_FAMILY}`;
  scratchCtx.textAlign = "center";
  scratchCtx.textBaseline = "middle";

  scratchCtx.fillStyle = t.BORDER;
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

      const data = getTileMetaData(x, y);
      const nearbyMines = state === TILE_REVEALED ? getNearbyMines(data) : 0;
      const canInteract = state === TILE_HIDDEN && getCanInteract(data);

      let bg = canInteract ? t.CAN : t.CANT;
      let tx = "";
      if (state === TILE_REVEALED) {
        if (mine) {
          bg = t.MINE_BG;
          tx = t.MINE_TX;
        } else {
          bg = t[`TILE_${nearbyMines}_BG` as keyof typeof t];
          tx = t[`TILE_${nearbyMines}_TX` as keyof typeof t];
        }
      } else if (state === TILE_FLAGGED) {
        bg = t.FLAG_BG;
        tx = t.FLAG_TX;
      }

      let scale = 1;
      if (state === TILE_REVEALED) {
        const anim = revealAnim.get(packTileKey(x, y));
        if (anim !== undefined) {
          const t = Math.max(0, Math.min(1, (now - anim.start) / ANIMATION_DURATION));
          scale = 1 - (1 - t) * (1 - t);
        }
      }

      const w = px1 - px0;
      const h = py1 - py0;

      if (scale < 1) {
        scratchCtx.fillStyle = t.CAN;
        if (drawDetails) {
          scratchCtx.beginPath();
          scratchCtx.roundRect(
            px0 + borderWidth,
            py0 + borderWidth,
            w - borderWidth * 2,
            h - borderWidth * 2,
            borderRadius,
          );
          scratchCtx.fill();
        } else {
          scratchCtx.fillRect(px0, py0, w, h);
        }
      }

      scratchCtx.save();
      scratchCtx.translate(px0 + w / 2, py0 + h / 2);
      scratchCtx.scale(scale, scale);
      scratchCtx.fillStyle = bg;

      if (drawDetails) {
        scratchCtx.beginPath();
        scratchCtx.roundRect(
          -w / 2 + borderWidth,
          -h / 2 + borderWidth,
          w - borderWidth * 2,
          h - borderWidth * 2,
          borderRadius,
        );
        scratchCtx.fill();

        if (tx) {
          let text = "";
          if (state === TILE_REVEALED) {
            if (mine) text = "💥";
            else if (nearbyMines > 0) {
              text = String(nearbyMines);
            }
          } else if (state === TILE_FLAGGED) text = "🚩";

          if (text) {
            scratchCtx.fillStyle = tx;
            scratchCtx.fillText(String(text), 0, h * 0.03);
          }
        }
      } else {
        scratchCtx.fillRect(-w / 2, -h / 2, w, h);
      }

      scratchCtx.restore();
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

function getChunk(level: number, cx: number, cy: number, now: number): ImageBitmap {
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

  const bitmap = renderChunk(level, cx, cy, now);
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

function draw(now: number): void {
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
      const bitmap = getChunk(range.level, cx, cy, now);
      const size = Math.ceil(worldSize * zoom);
      ctx.drawImage(bitmap, screenX, screenY, size, size);
    }
  }
}

const revealQueue: [x: number, y: number, revealAt: number][] = [];
const revealAnim = new Map<number, { x: number; y: number; start: number }>();
let revealQueueHead = 0;
let dirty = true;

function tick(): void {
  const now = performance.now();

  if (now - lastSweep >= SWEEPER_INTERVAL_MS) {
    lastSweep = now;
    sweepUnusedChunks();
  }

  let i = 0;
  while (revealQueueHead < revealQueue.length && i++ < 100) {
    const [sx, sy, sRevealAt] = revealQueue[revealQueueHead++]!;

    const finished = isFinished(getTileMetaData(sx, sy));
    if (!finished) continue;

    const childRevealAt = sRevealAt + ANIMATION_DELAY;

    for (const [ox, oy] of NEIGHBOUR_OFFSETS) {
      const [x, y] = [sx + ox, sy + oy];
      const state = getTile(x, y);
      const mine = hasMine(x, y);

      if (state === TILE_FLAGGED && mine) continue;

      setTile(x, y, TILE_REVEALED);
      if (state === TILE_HIDDEN) {
        revealAnim.set(packTileKey(x, y), { x, y, start: childRevealAt });
        revealQueue.push([x, y, childRevealAt]);
      }
      dirty = true;
    }
  }

  if (revealQueueHead > 1000 && revealQueueHead > revealQueue.length / 2) {
    revealQueue.splice(0, revealQueueHead);
    revealQueueHead = 0;
  }

  if (revealAnim.size > 0) {
    for (const { x, y, start } of revealAnim.values()) {
      if (now - start >= ANIMATION_DURATION) {
        revealAnim.delete(packTileKey(x, y));
      }
      invalidateTile(x, y);
    }
    dirty = true;
  }

  if (dirty) {
    draw(now);
    dirty = false;
  }

  requestAnimationFrame(tick);
}

function handleTileClick(x: number, y: number, reveal: boolean, touchControls: boolean): void {
  if (BITMAP_RES / (chunkWorldSize(pickLevel()) / TILE_WORLD_SIZE) < DRAW_DETAILS_START) return;

  const state = getTile(x, y);

  if (started) {
    const canInteract = state !== TILE_HIDDEN || getCanInteract(getTileMetaData(x, y));
    if (!canInteract) return;
  }

  if ((reveal || touchControls) && state === TILE_REVEALED) {
    if (isFinished(getTileMetaData(x, y))) revealQueue.push([x, y, performance.now()]);
    return;
  }

  if (reveal) {
    if (state === TILE_HIDDEN) {
      if (!started) {
        started = true;
        startX = x;
        startY = y;
      }
      const now = performance.now();
      setTile(x, y, TILE_REVEALED);
      revealAnim.set(packTileKey(x, y), { x, y, start: now });
      revealQueue.push([x, y, now]);
    }
  } else if (started) {
    if (state === TILE_HIDDEN) setTile(x, y, TILE_FLAGGED);
    else if (state === TILE_FLAGGED) setTile(x, y, TILE_HIDDEN);
    else return;
  }

  dirty = true;
}

function reset(): void {
  tileStates.clear();
  metaDataCache.clear();
  chunkCache.clear();

  seed = randomSeed();

  started = false;
  startX = 0;
  startY = 0;

  camX = 0;
  camY = 0;

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
  let longPress = false;
  let panning = false;
  let pinching = false;
  let initialX = 0;
  let initialY = 0;
  let dragX = 0;
  let dragY = 0;
  let initialPinchDistance = 0;
  let initialPinchZoom = 0;
  let longPressTimer: number | null = null;

  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
    activePointers.push(e);

    panning = false;
    longPress = false;

    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (activePointers.length === 1 && !pinching) {
      initialX = e.clientX;
      initialY = e.clientY;
      dragX = e.clientX + camX * zoom;
      dragY = e.clientY + camY * zoom;

      if (e.pointerType === "touch") {
        longPressTimer = setTimeout(() => {
          longPress = true;
        }, LONG_PRESS_DURATION);
      }
    } else if (activePointers.length === 2) {
      pinching = true;
      const [p1, p2] = activePointers as [PointerEvent, PointerEvent];
      initialPinchDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      initialPinchZoom = zoom;
    }
  });

  window.addEventListener("pointermove", (e) => {
    const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
    if (index !== -1) activePointers[index] = e;

    if (activePointers.length === 1) {
      if (!panning && Math.hypot(e.clientX - initialX, e.clientY - initialY) >= PAN_THRESHOLD) {
        panning = true;

        if (longPressTimer !== null) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }

        if (started) {
          canvas.style.cursor = "grabbing";
        }
      }

      if (panning && started) {
        camX = (dragX - e.clientX) / zoom;
        camY = (dragY - e.clientY) / zoom;
        dirty = true;
      }
    } else if (activePointers.length === 2) {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      const [p1, p2] = activePointers as [PointerEvent, PointerEvent];
      const currentDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      if (initialPinchDistance > 0) {
        const midX = (p1.clientX + p2.clientX) / 2;
        const midY = (p1.clientY + p2.clientY) / 2;
        updateZoom(initialPinchZoom * (currentDistance / initialPinchDistance), midX, midY);
      }
    }
  });

  function handlePointerUp(e: PointerEvent): void {
    const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
    if (index !== -1) activePointers.splice(index, 1);
    else return;

    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (!panning) {
      const rect = canvas.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;

      const worldX = camX + (mouseScreenX - canvasWidth / 2) / zoom;
      const worldY = camY + (mouseScreenY - canvasHeight / 2) / zoom;

      const x = Math.floor(worldX / TILE_WORLD_SIZE);
      const y = Math.floor(worldY / TILE_WORLD_SIZE);

      handleTileClick(
        x,
        y,
        e.pointerType === "touch" ? longPress : e.button === 0,
        e.pointerType === "touch",
      );
    }

    if (panning) {
      panning = false;
      canvas.style.cursor = "default";
    }

    pinching = false;
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

  const restartButton = document.querySelector<HTMLButtonElement>("#restartButton");
  if (restartButton) {
    let resetTimeout: number | null = null;

    // TODO: Clicking a tile while resetTimeout is active should trigger state1
    const state1 = (): void => {
      restartButton.textContent = "Reset";
      restartButton.onclick = state2;

      if (resetTimeout !== null) {
        clearTimeout(resetTimeout);
        resetTimeout = null;
      }
    };

    const state2 = (): void => {
      restartButton.textContent = "Are you sure?";
      restartButton.onclick = (): void => {
        reset();
        state1();
      };

      resetTimeout = setTimeout(state1, RESET_TIMEOUT_MS);
    };

    state1();
  } else console.warn("Could not get restartButton element");
}

document.fonts
  .load(`0px ${FONT_FAMILY}`)
  .then(() => requestAnimationFrame(tick))
  .catch(console.error);
