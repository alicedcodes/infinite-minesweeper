import { easeOutQuad, hsl, mulberry32 } from "./utils";

type TileKey = string & { readonly __brand: unique symbol };
type TileState = number;

const tileMap = new Map<TileKey, TileState>();

const TILE_HIDDEN = 0;
const TILE_SHOWN = 1;
const TILE_FLAGGED = 2;

let GAME_SEED: number = 0;

function toTileKey(row: number, col: number): TileKey {
  return `${row},${col}` as TileKey;
}

function hashHasMine(row: number, col: number, mineDensity: number = 0.15): boolean {
  if (row === 0 && col === 0) return false;
  if (Math.abs(row) <= 1 && Math.abs(col) <= 1) return false;

  const spatialCoordinateHash = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
  const coordinateInt = Math.floor(spatialCoordinateHash) | 0;

  return mulberry32(coordinateInt ^ GAME_SEED) < mineDensity;
}

function getTileState(row: number, col: number): TileState {
  return tileMap.get(toTileKey(row, col)) ?? TILE_HIDDEN;
}

function countSurroundingMines(row: number, col: number): number {
  let count = 0;

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      if (hashHasMine(row + dr, col + dc)) count++;
    }
  }

  return count;
}

function isClickable(row: number, col: number): boolean {
  if (row === 0 && col === 0) return true;

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if ((dr !== 0 || dc !== 0) && getTileState(row + dr, col + dc) === TILE_SHOWN) {
        return true;
      }
    }
  }

  return false;
}

function toggleFlag(row: number, col: number): void {
  const key = toTileKey(row, col);
  const state = getTileState(row, col);

  if (state === TILE_SHOWN) {
    revealSurroundingTiles(row, col);
    return;
  }

  if (state === TILE_HIDDEN) tileMap.set(key, TILE_FLAGGED);
  else if (state === TILE_FLAGGED) tileMap.delete(key);
}

function setShown(row: number, col: number): void {
  const key = toTileKey(row, col);
  const state = getTileState(row, col);

  if (state === TILE_SHOWN) {
    revealSurroundingTiles(row, col);
    return;
  }

  if (state === TILE_FLAGGED || !isClickable(row, col)) return;

  tileMap.set(key, TILE_SHOWN);

  if (!animationMap.has(key)) {
    animationMap.set(key, performance.now());
  }

  if (hashHasMine(row, col)) {
    console.log("MINE!");
  } else if (countSurroundingMines(row, col) === 0) {
    cascadeReveal(row, col);
  }
}

function revealSurroundingTiles(row: number, col: number): void {
  const targetMines = countSurroundingMines(row, col);

  let flagCount = 0;

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const neighborState = getTileState(row + dr, col + dc);
      if (neighborState === TILE_FLAGGED) flagCount++;
      else if (neighborState === TILE_SHOWN && hashHasMine(row + dr, col + dc)) flagCount++;
    }
  }

  if (flagCount === targetMines) {
    let staggerStep = 0;
    const now = performance.now();

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        const nr = row + dr;
        const nc = col + dc;
        const nKey = toTileKey(nr, nc);
        const neighborState = getTileState(nr, nc);

        if (neighborState === TILE_HIDDEN) {
          if (!hashHasMine(nr, nc) && countSurroundingMines(nr, nc) === 0) {
            cascadeReveal(nr, nc);
          } else {
            staggerStep++;
            const delayTime = staggerStep * ANIMATION_DELAY;

            tileMap.set(nKey, TILE_SHOWN);

            if (!animationMap.has(nKey)) {
              animationMap.set(nKey, now + delayTime);
            }
          }
        }
      }
    }
  }
}

function cascadeReveal(startRow: number, startCol: number): void {
  const startKey = toTileKey(startRow, startCol);

  const queue: [number, number][] = [[startRow, startCol]];
  const visited: Set<TileKey> = new Set([startKey]);

  let staggerStep = 0;
  const now = performance.now();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const [r, c] = current;
    const key = toTileKey(r, c);

    tileMap.set(key, TILE_SHOWN);
    staggerStep++;

    const delayTime = staggerStep * ANIMATION_DELAY;
    if (!animationMap.has(key)) {
      animationMap.set(key, now + delayTime);
    }

    if (countSurroundingMines(r, c) === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;

          const nr = r + dr;
          const nc = c + dc;
          const nKey = toTileKey(nr, nc);

          if (visited.has(nKey) || getTileState(nr, nc) !== TILE_HIDDEN) continue;

          visited.add(nKey);

          if (!hashHasMine(nr, nc)) {
            queue.push([nr, nc]);
          }
        }
      }
    }
  }
}

//

const CANVAS_ID = "fmsCanvas";

const TILE_SIZE = 100;

const colour = {
  background: hsl(0, 0, 0.5, 0.25),
  border: hsl(0, 0, 0.5, 0.4),
  firstTx: hsl(120, 1, 0.5),
  flag: hsl(60, 1, 0.7),
  mine: hsl(15, 1, 0.7),
  number: {
    1: hsl(240, 1, 0.5),
    2: hsl(120, 1, 0.25),
    3: hsl(0, 1, 0.5),
    4: hsl(240, 1, 0.25),
    5: hsl(330, 1, 0.5),
    6: hsl(180, 1, 0.5),
    7: hsl(0, 0, 0),
    8: hsl(0, 0, 0.5),
    9: hsl(0, 0, 1),
  },
  shown: hsl(0, 0, 0.85),
  text: hsl(0, 0, 0),
};

const MIN_ZOOM = 1 / 16;
const MAX_ZOOM = 2;
const ZOOM_SENSITIVITY = 0.0005;

const camera = {
  x: 0,
  y: 0,
  zoom: 1,
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

let swapButtonControls = true;

const ANIMATION_DELAY = 10;
const ANIMATION_DURATION = 100;

const animationMap = new Map<TileKey, number>();

function screenPositionToCanvas(
  screenX: number,
  screenY: number,
): { canvasX: number; canvasY: number } {
  if (!canvas) return { canvasX: 0, canvasY: 0 };

  const rect = canvas.getBoundingClientRect();
  const canvasX = screenX - rect.left - canvas.width / 2;
  const canvasY = screenY - rect.top - canvas.height / 2;

  return { canvasX, canvasY };
}

function getTileStartIndices(): { tileStartX: number; tileStartY: number } {
  const tileStartX = -camera.x / (TILE_SIZE * camera.zoom);
  const tileStartY = -camera.y / (TILE_SIZE * camera.zoom);

  return { tileStartX, tileStartY };
}

const UI = {
  draw(now = performance.now()): void {
    if (!canvas || !ctx) return;

    for (const [key, startTime] of animationMap.entries()) {
      if (now - startTime >= ANIMATION_DURATION) animationMap.delete(key);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaledTileSize = TILE_SIZE * camera.zoom;

    const centreX = canvas.width / 2;
    const centreY = canvas.height / 2;

    const { tileStartX, tileStartY } = getTileStartIndices();

    const tileRadiusX = canvas.width / 2 / scaledTileSize;
    const tileRadiusY = canvas.height / 2 / scaledTileSize;

    const rowStart = Math.floor(tileStartY - tileRadiusY) - 1;
    const colStart = Math.floor(tileStartX - tileRadiusX) - 1;
    const rowEnd = Math.ceil(tileStartY + tileRadiusY) + 1;
    const colEnd = Math.ceil(tileStartX + tileRadiusX) + 1;

    const renderDetails = camera.zoom > MIN_ZOOM;
    const fontSize = renderDetails ? Math.floor(48 * camera.zoom) : 0;

    ctx.lineWidth = 1 * camera.zoom;
    ctx.font = `bold ${fontSize}px "Noto Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        if (!isClickable(row, col)) continue;

        const key = toTileKey(row, col);
        const state = getTileState(row, col);

        const x1 = Math.floor(centreX + (col - tileStartX) * scaledTileSize - scaledTileSize / 2);
        const x2 = Math.floor(
          centreX + (col + 1 - tileStartX) * scaledTileSize - scaledTileSize / 2,
        );
        const y1 = Math.floor(centreY + (row - tileStartY) * scaledTileSize - scaledTileSize / 2);
        const y2 = Math.floor(
          centreY + (row + 1 - tileStartY) * scaledTileSize - scaledTileSize / 2,
        );

        const width = x2 - x1;
        const height = y2 - y1;

        let bg: string | null = null;
        let tx = colour.text;
        let text = "";

        if (state === TILE_SHOWN) {
          if (hashHasMine(row, col)) {
            bg = colour.mine;
            text = "💥";
          } else {
            bg = colour.shown;

            const surroundingMines = countSurroundingMines(row, col);
            if (surroundingMines > 0) {
              tx = colour.number[surroundingMines as keyof typeof colour.number] ?? tx;
              text = `${surroundingMines}`;
            }
          }
        } else if (state === TILE_FLAGGED) {
          bg = colour.flag;
          text = "🚩";
        } else if (row === 0 && col === 0 && tileMap.size === 0) {
          tx = colour.firstTx;
          text = "✅";
        }

        let animScale = 1;

        if (animationMap.has(key)) {
          const startTime = animationMap.get(key)!;
          const elapsed = now - startTime;

          const progress = elapsed / ANIMATION_DURATION;
          animScale = easeOutQuad(progress);
        }

        ctx.fillStyle = colour.background;
        ctx.fillRect(x1, y1, width, height);

        if (animScale > 0) {
          const tileCenterX = x1 + width / 2;
          const tileCenterY = y1 + height / 2;

          if (animScale !== 1) {
            ctx.save();
            ctx.translate(tileCenterX, tileCenterY);
            ctx.scale(animScale, animScale);

            if (bg) {
              ctx.fillStyle = bg;
              ctx.fillRect(-width / 2, -height / 2, width, height);
            }

            if (text) {
              ctx.fillStyle = tx;
              ctx.fillText(text, 0, 0);
            }

            ctx.restore();
          } else {
            if (bg) {
              ctx.fillStyle = bg;
              ctx.fillRect(x1, y1, width, height);
            }

            if (text) {
              ctx.fillStyle = tx;
              ctx.fillText(text, tileCenterX, tileCenterY);
            }
          }
        }

        if (renderDetails) {
          ctx.strokeStyle = colour.border;
          ctx.strokeRect(x1, y1, width, height);
        }
      }
    }
  },
  setupListeners(): void {
    if (!canvas) return;

    canvas.style.touchAction = "none";
    canvas.style.cursor = "default";

    const DRAG_THRESHOLD = 5;
    const LONG_PRESS_DURATION = 350;

    const activePointers = new Map<number, PointerEvent>();

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let dragStartX = 0;
    let dragStartY = 0;

    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let isLongPress = false;

    let wasPinching = false;

    let initialPinchDistance = 0;
    let initialPinchZoom = camera.zoom;

    const clearLongPress = () => {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    const handleClick = (e: PointerEvent, forceSecondary = false): void => {
      if (!canvas) return;

      const { canvasX, canvasY } = screenPositionToCanvas(e.clientX, e.clientY);
      const { tileStartX, tileStartY } = getTileStartIndices();

      const tileX = canvasX / (TILE_SIZE * camera.zoom) + tileStartX;
      const tileY = canvasY / (TILE_SIZE * camera.zoom) + tileStartY;

      const row = Math.floor(tileY + 0.5);
      const col = Math.floor(tileX + 0.5);

      const isSecondary = forceSecondary || e.button === 2;
      const isPrimaryAction = isSecondary ? swapButtonControls : !swapButtonControls;

      if (isPrimaryAction || tileMap.size === 0) {
        setShown(row, col);
      } else {
        toggleFlag(row, col);
      }
    };

    const getPointerDistance = (p1: PointerEvent, p2: PointerEvent): number => {
      const dx = p1.clientX - p2.clientX;
      const dy = p1.clientY - p2.clientY;
      return Math.hypot(dx, dy);
    };

    const observer = new ResizeObserver(() => {
      if (!canvas) return;
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    });
    observer.observe(canvas);

    canvas.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;

      activePointers.set(e.pointerId, e);
      clearLongPress();
      isLongPress = false;

      if (activePointers.size === 1 && !wasPinching) {
        isDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        dragStartX = e.clientX - camera.x;
        dragStartY = e.clientY - camera.y;

        if (e.pointerType === "touch") {
          longPressTimer = setTimeout(() => {
            isLongPress = true;
            if (navigator.vibrate) navigator.vibrate(40);
            handleClick(e, true);
          }, LONG_PRESS_DURATION);
        }
      } else if (activePointers.size === 2) {
        wasPinching = true;
        isDragging = false;

        const [p1, p2] = Array.from(activePointers.values()) as [PointerEvent, PointerEvent];
        initialPinchDistance = getPointerDistance(p1, p2);
        initialPinchZoom = camera.zoom;
      }
    });

    window.addEventListener("pointermove", (e: PointerEvent) => {
      if (!canvas || !activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, e);

      if (activePointers.size === 2) {
        clearLongPress();
        const [p1, p2] = Array.from(activePointers.values()) as [PointerEvent, PointerEvent];
        const currentDistance = getPointerDistance(p1, p2);

        if (initialPinchDistance > 0) {
          const scale = currentDistance / initialPinchDistance;
          const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialPinchZoom * scale));

          if (targetZoom !== camera.zoom && tileMap.size > 0) {
            const midX = (p1.clientX + p2.clientX) / 2;
            const midY = (p1.clientY + p2.clientY) / 2;

            const { canvasX, canvasY } = screenPositionToCanvas(midX, midY);

            camera.x = canvasX - ((canvasX - camera.x) * targetZoom) / camera.zoom;
            camera.y = canvasY - ((canvasY - camera.y) * targetZoom) / camera.zoom;
            camera.zoom = targetZoom;
          }
        }
        return;
      }

      if (activePointers.size === 1 && !wasPinching && tileMap.size > 0) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!isDragging) {
          if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
            isDragging = true;
            clearLongPress();
          }
        } else {
          camera.x = e.clientX - dragStartX;
          camera.y = e.clientY - dragStartY;
          canvas.style.cursor = "grabbing";
        }
      }
    });

    const handlePointerUp = (e: PointerEvent): void => {
      if (!activePointers.has(e.pointerId)) return;

      clearLongPress();

      if (activePointers.size === 1 && !isDragging && !isLongPress && !wasPinching) {
        handleClick(e);
      }

      activePointers.delete(e.pointerId);

      if (activePointers.size === 0) {
        isDragging = false;
        isLongPress = false;
        wasPinching = false;
        if (canvas) canvas.style.cursor = "default";
      }
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!canvas) return;
        e.preventDefault();

        const zoomChange = -e.deltaY * ZOOM_SENSITIVITY;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom + zoomChange));

        if (newZoom === camera.zoom) return;

        if (tileMap.size > 0) {
          const { canvasX, canvasY } = screenPositionToCanvas(e.clientX, e.clientY);

          camera.x = canvasX - ((canvasX - camera.x) * newZoom) / camera.zoom;
          camera.y = canvasY - ((canvasY - camera.y) * newZoom) / camera.zoom;
        }

        camera.zoom = newZoom;
      },
      { passive: false },
    );
  },
  tick(timestamp = performance.now()): void {
    UI.draw(timestamp);
    requestAnimationFrame((t) => UI.tick(t));
  },
};

//

const DB_NAME = "FMSDB";
const TILE_STORE = "tileSaveState";
const META_STORE = "gameMetadata";
const DB_VERSION = 1;

const Storage = {
  async loadGame(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([TILE_STORE, META_STORE], "readonly");

      const tileStore = transaction.objectStore(TILE_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      const tileRequest = tileStore.getAll();
      const metaRequest = metaStore.getAll();

      await new Promise<void>((resolve, reject) => {
        let itemsLoaded = 0;
        const checkDone = (): void => {
          if (++itemsLoaded === 2) resolve();
        };

        tileRequest.onsuccess = checkDone;
        metaRequest.onsuccess = checkDone;
        transaction.onerror = (): void => reject(transaction.error);
      });

      tileMap.clear();
      const records = tileRequest.result as { id: string; s: number }[];
      for (const record of records) {
        tileMap.set(record.id as TileKey, record.s as TileState);
      }

      const metaResults = metaRequest.result as any[];
      const seedRecord = metaResults.find((m) => m.key === "seed");
      const camRecord = metaResults.find((m) => m.key === "camera");

      if (seedRecord) GAME_SEED = seedRecord.val;
      else GAME_SEED = Math.floor(Math.random() * 2147483647);

      if (camRecord) {
        camera.x = camRecord.x;
        camera.y = camRecord.y;
        camera.zoom = camRecord.z;
      } else {
        camera.x = 0;
        camera.y = 0;
        camera.zoom = 1.0;
      }
    } catch (err) {
      console.error("Critical loading phase fault:", err);
    }
  },
  openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event): void => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(TILE_STORE)) {
          db.createObjectStore(TILE_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };

      request.onsuccess = (event): void => resolve((event.target as IDBOpenDBRequest).result);
      request.onerror = (event): void => reject((event.target as IDBOpenDBRequest).error);
    });
  },
  async saveGame(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([TILE_STORE, META_STORE], "readwrite");

      const tileStore = transaction.objectStore(TILE_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      tileStore.clear();
      tileMap.forEach((state, key) => {
        tileStore.put({ id: key, s: state });
      });

      metaStore.put({ key: "seed", val: GAME_SEED });
      metaStore.put({ key: "camera", x: camera.x, y: camera.y, z: camera.zoom });

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = (): void => resolve();
        transaction.onerror = (): void => reject(transaction.error);
      });
    } catch (err) {
      console.error("Save system fault:", err);
    }
  },
};

//

let handleUpdateUi: (() => void) | null = null;

export const IMS = {
  colour,
  async init(): Promise<void> {
    const canvas_ = document.getElementById(CANVAS_ID);

    if (!canvas_) {
      throw new Error(`Canvas with id ${CANVAS_ID} not found!`);
    }

    if (!(canvas_ instanceof HTMLCanvasElement)) {
      throw new Error(`Element with id ${CANVAS_ID} is not a canvas!`);
    }

    canvas = canvas_;
    ctx = canvas.getContext("2d")!;

    await Storage.loadGame();

    UI.setupListeners();
    UI.tick();

    window.addEventListener("beforeunload", () => {
      void Storage.saveGame();
    });
  },
  onUpdateUi: (callback: (() => void) | null): void => {
    handleUpdateUi = callback;
    if (handleUpdateUi) {
      handleUpdateUi();
    }
  },
  restart(): void {
    tileMap.clear();

    GAME_SEED = Math.floor(Math.random() * 2147483647);

    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1.0;
  },
};

(window as any).IMS = IMS;
