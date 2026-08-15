import ease from "./ease";

type TileKey = `${number}_${number}`;
type TileState = 0 | 1 | 2;

interface MetaData {
  isInteractable: boolean;
  nearbyMines: number;
  nearbyRevealedMines: number;
  nearbyFlags: number;
}

const NEIGHBOUR_OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

const TILE_HIDE = 0;
const TILE_SHOW = 1;
const TILE_FLAG = 2;

const DEFAULT_DENSITY = 0.2;

const stateMap = new Map<TileKey, TileState>();
const mineMap = new Map<TileKey, boolean>();
const metaMap = new Map<TileKey, MetaData>();
const animMap = new Map<TileKey, number>();

let globalSeed = 0;
let mineDensity = DEFAULT_DENSITY;

function calcTileKey(row: number, col: number): TileKey {
  return `${row}_${col}`;
}

function calcSeed(): number {
  const array = new Int32Array(1);
  window.crypto.getRandomValues(array);
  return array[0]!;
}

function calcHasMine(row: number, col: number): boolean {
  if (Math.abs(row) <= 1 && Math.abs(col) <= 1) return false;
  let h = globalSeed ^ (row * 73856093) ^ (col * 19349663);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  const hashVal = (h ^ (h >>> 16)) >>> 0;
  return hashVal < mineDensity * 4294967296;
}

function getMine(row: number, col: number): boolean {
  const key = calcTileKey(row, col);
  let hasMine = mineMap.get(key);

  if (hasMine === undefined) {
    hasMine = calcHasMine(row, col);
    mineMap.set(key, hasMine);
  }

  return hasMine;
}

function getState(row: number, col: number): TileState {
  return stateMap.get(calcTileKey(row, col)) ?? TILE_HIDE;
}

function getMeta(row: number, col: number): MetaData {
  const key = calcTileKey(row, col);
  let meta: MetaData | undefined = metaMap.get(key);

  if (meta === undefined) {
    meta = {
      isInteractable: row === 0 && col === 0,
      nearbyMines: 0,
      nearbyRevealedMines: 0,
      nearbyFlags: 0,
    };

    for (let i = 0; i < NEIGHBOUR_OFFSETS.length; i++) {
      const offset = NEIGHBOUR_OFFSETS[i]!;
      const nr = row + offset[0];
      const nc = col + offset[1];
      const m = getMine(nr, nc);
      const s = getState(nr, nc);

      if (m) meta.nearbyMines++;

      if (s === TILE_SHOW) {
        meta.isInteractable = true;
        if (m) meta.nearbyRevealedMines++;
      } else if (s === TILE_FLAG) meta.nearbyFlags++;
    }

    metaMap.set(key, meta);
  }

  return meta;
}

function updateTile(row: number, col: number, newState: TileState): void {
  const key = calcTileKey(row, col);
  const currentState = stateMap.get(key) ?? TILE_HIDE;
  if (newState === currentState) return;

  if (newState === TILE_HIDE) stateMap.delete(key);
  else stateMap.set(key, newState);

  for (let i = 0; i < NEIGHBOUR_OFFSETS.length; i++) {
    const offset = NEIGHBOUR_OFFSETS[i]!;
    const nr = row + offset[0];
    const nc = col + offset[1];
    const nk = calcTileKey(nr, nc);
    metaMap.delete(nk);
  }

  isDirty = true;
}

// TODO: Mode doCascadeReveal and doAnswersReveal into doTick to increase reactivity
function doCascadeReveal(startRow: number, startCol: number, now: number): void {
  const visited = new Set<TileKey>();
  const queue: [number, number, number][] = [[startRow, startCol, 0]];
  const distances = new Map<TileKey, number>();

  const startKey = calcTileKey(startRow, startCol);
  distances.set(startKey, 0);

  let index = 0;
  while (index < queue.length) {
    const [row, col, dist] = queue[index++]!;
    const key = calcTileKey(row, col);

    if (visited.has(key)) continue;
    visited.add(key);

    const mine = getMine(row, col);
    const state = getState(row, col);

    if (state === TILE_HIDE || (state === TILE_FLAG && !mine)) {
      updateTile(row, col, TILE_SHOW);
      animMap.set(key, now + dist * ANIMATION_DELAY);
    }

    const { nearbyMines } = getMeta(row, col);

    if (!mine && nearbyMines === 0) {
      for (let i = 0; i < NEIGHBOUR_OFFSETS.length; i++) {
        const offset = NEIGHBOUR_OFFSETS[i]!;
        const nextRow = row + offset[0];
        const nextCol = col + offset[1];
        const nk = calcTileKey(nextRow, nextCol);

        if (!visited.has(nk) && !distances.has(nk)) {
          const nextDist = dist + 1;
          distances.set(nk, nextDist);
          queue.push([nextRow, nextCol, nextDist]);
        }
      }
    }
  }
}

function doAnswersReveal(startRow: number, startCol: number, now: number): void {
  const { nearbyMines, nearbyRevealedMines, nearbyFlags } = getMeta(startRow, startCol);
  if (nearbyMines !== nearbyFlags + nearbyRevealedMines) return;

  for (let i = 0; i < NEIGHBOUR_OFFSETS.length; i++) {
    const [or, oc] = NEIGHBOUR_OFFSETS[i]!;
    const nr = startRow + or;
    const nc = startCol + oc;

    if (getState(nr, nc) !== TILE_SHOW) {
      doCascadeReveal(nr, nc, now);
    }
  }
}

//

type MineCount = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type ThemeData = {
  name: string;
} & Record<"BORDER" | "BG" | "BG_I" | "TX" | `${"BG" | "TX"}_${MineCount}`, string>;

type ColorSource = string | ((n: number) => string);

type ThemeConfig = {
  name: string;
  BG: string;
  BG_I: string;
  BG_N: ColorSource;
  BORDER: string;
  TX: string;
  TX_N: ColorSource;
};

const calcTheme = /* @__PURE__ */ (tc: ThemeConfig): ThemeData => {
  const mineCounts = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  const bgEntries = mineCounts.map((n) => [
    `BG_${n}`,
    typeof tc.BG_N === "function" ? tc.BG_N(n) : tc.BG_N,
  ]);

  const txEntries = mineCounts.map((n) => [
    `TX_${n}`,
    typeof tc.TX_N === "function" ? tc.TX_N(n) : tc.TX_N,
  ]);

  return Object.fromEntries([
    ["name", tc.name],
    ["BG", tc.BG],
    ["BG_I", tc.BG_I],
    ["BORDER", tc.BORDER],
    ["TX", tc.TX],
    ...bgEntries,
    ...txEntries,
  ]) as ThemeData;
};

const THEME_DATA: ThemeData[] = [
  calcTheme({
    name: "Colourful",
    BG: "oklch(0.3 0 0)",
    BG_I: "oklch(0.3 0 0 / 0.15)",
    BG_N: (n) => `oklch(0.8 0.35 ${((360 / 8) * Math.max(1, n)) % 360})`,
    BORDER: "oklch(0.2 0 0)",
    TX: "oklch(1 0 0)",
    TX_N: "oklch(0 0 0)",
  }),
  calcTheme({
    name: "Night",
    BG: "oklch(0.3 0 0)",
    BG_I: "oklch(0.3 0 0 / 0.15)",
    BG_N: "oklch(0.2 0 0)",
    BORDER: "oklch(0.2 0 0)",
    TX: "oklch(1 0 0)",
    TX_N: (n) => `oklch(0.8 0.35 ${((360 / 8) * Math.max(1, n)) % 360})`,
  }),
  calcTheme({
    name: "Black",
    BG: "oklch(0.3 0 0)",
    BG_I: "oklch(0 0 0 / 0)",
    BG_N: "oklch(0 0 0)",
    BORDER: "oklch(0 0 0)",
    TX: "oklch(1 0 0)",
    TX_N: "oklch(1 0 0)",
  }),
  calcTheme({
    name: "Light",
    BG: "oklch(0.8 0 0)",
    BG_I: "oklch(0 0 0 / 0)",
    BG_N: "oklch(1 0 0)",
    BORDER: "oklch(1 0 0)",
    TX: "oklch(0 0 0)",
    TX_N: (n) => `oklch(0.8 0.35 ${((360 / 8) * Math.max(1, n)) % 360})`,
  }),
  calcTheme({
    name: "White",
    BG: "oklch(0.8 0 0)",
    BG_I: "oklch(0 0 0 / 0)",
    BG_N: "oklch(1 0 0)",
    BORDER: "oklch(1 0 0)",
    TX: "oklch(0 0 0)",
    TX_N: "oklch(0 0 0)",
  }),
];

//

const TILE_SIZE = 100;
const BORDER_WIDTH = 4;
const BORDER_RADIUS = 8;
const FONT_SIZE = 48;
const FONT_FAMILY = 'Arial, Helvetica, sans-serif, "Noto Emoji Variable"';

const MIN_ZOOM = 1 / 16;
const MAX_ZOOM = 2;
const WHEEL_ZOOM_SPEED = 0.001;
const PAN_THRESHOLD = 10;
const LONG_PRESS_DURATION = 350;

const ANIMATION_DELAY = 20;
const ANIMATION_DURATION = 150;

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

let isDirty = true;

let zoom = 1;
let camX = 0;
let camY = 0;

let theme = 0;

function calcPointerDistance(p1: PointerEvent, p2: PointerEvent): number {
  return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
}

function calcScreenToTile(clientX: number, clientY: number): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const lx = clientX - rect.left - canvas.width / 2;
  const ly = clientY - rect.top - canvas.height / 2;
  const ts = TILE_SIZE * zoom;
  return [Math.floor(ly / ts - camY / ts + 0.5), Math.floor(lx / ts - camX / ts + 0.5)];
}

function calcAnimate(progress: number): number {
  return ease.out.quad(progress);
}

function updateZoom(targetZoom: number, clientX: number, clientY: number): void {
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
  if (zoom === newZoom) return;

  const rect = canvas.getBoundingClientRect();
  const lx = clientX - rect.left - rect.width / 2;
  const ly = clientY - rect.top - rect.height / 2;

  camX = lx - ((lx - camX) * newZoom) / zoom;
  camY = ly - ((ly - camY) * newZoom) / zoom;
  zoom = newZoom;
  isDirty = true;
}

function doTick(): void {
  const now = performance.now();

  if (animMap.size > 0) {
    animMap.forEach((start, key) => {
      if (now >= start + ANIMATION_DURATION) {
        animMap.get(key);
        animMap.delete(key);
      }
      isDirty = true;
    });
  }

  if (isDirty) doDraw(now);
  requestAnimationFrame(doTick);
}

function doDraw(now: number): void {
  const { width: cw, height: ch } = canvas!;

  ctx.clearRect(0, 0, cw, ch);
  ctx.save();

  const ts = TILE_SIZE * zoom;
  const bw = BORDER_WIDTH * zoom;
  const br = BORDER_RADIUS * zoom;
  const t = THEME_DATA[theme] ?? THEME_DATA[0]!;

  const centreX = -camX / ts;
  const centreY = -camY / ts;

  const rowMin = Math.floor(centreY - ch / 2 / ts) - 1;
  const rowMax = Math.ceil(centreY + ch / 2 / ts) + 1;
  const colMin = Math.floor(centreX - cw / 2 / ts) - 1;
  const colMax = Math.ceil(centreX + cw / 2 / ts) + 1;

  for (let row = rowMin; row <= rowMax; row++) {
    const y = Math.floor(ch / 2 + (row - centreY) * ts - ts / 2);
    const h = Math.floor(ch / 2 + (row + 1 - centreY) * ts - ts / 2) - y;

    for (let col = colMin; col <= colMax; col++) {
      const x = Math.floor(cw / 2 + (col - centreX) * ts - ts / 2);
      const w = Math.floor(cw / 2 + (col + 1 - centreX) * ts - ts / 2) - x;

      const mine = getMine(row, col);
      const state = getState(row, col);
      const { nearbyMines, isInteractable } = getMeta(row, col);

      let bgColour = isInteractable ? t.BG : t.BG_I;
      let txColour = t.TX;
      let text: string | null = null;
      let textSize = 1;

      ({
        [TILE_HIDE]: () => {
          if (row === 0 && col === 0 && stateMap.size === 0) {
            text = "Start!";
            textSize = 0.5;
          }
        },
        [TILE_SHOW]: () => {
          if (mine) {
            text = "💥";
            textSize = 1.5;
          } else {
            bgColour = t[`BG_${nearbyMines as MineCount}`];
            if (nearbyMines > 0) {
              txColour = t[`TX_${nearbyMines as MineCount}`];
              text = String(nearbyMines);
            }
          }
        },
        [TILE_FLAG]: () => {
          text = "🚩";
          textSize = 1.5;
        },
      })[state]();

      if (!isInteractable) bgColour = t.BG_I;

      let scale = 1;
      const start = animMap.get(calcTileKey(row, col));

      if (start !== undefined) {
        const progress = Math.max(0, Math.min(1, (now - start) / ANIMATION_DURATION));
        scale = calcAnimate(progress);
      }

      const lx = -w / 2;
      const ly = -h / 2;

      ctx.save();
      ctx.fillStyle = t.BORDER;
      ctx.fillRect(x, y, w, h);

      if (scale < 1) {
        ctx.fillStyle = t.BG;
        ctx.beginPath();
        ctx.roundRect(x + bw, y + bw, w - bw * 2, h - bw * 2, br);
        ctx.fill();
      }

      ctx.save();

      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(scale, scale);

      ctx.fillStyle = bgColour;
      ctx.beginPath();
      ctx.roundRect(lx + bw, ly + bw, w - bw * 2, h - bw * 2, br);
      ctx.fill();

      if (text) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${FONT_SIZE * textSize * zoom}px ${FONT_FAMILY}`;
        ctx.fillStyle = txColour;
        ctx.fillText(text, 0, 3 * zoom);
      }

      ctx.restore();
      ctx.restore();
    }
  }

  ctx.restore();
  isDirty = false;
}

//

interface WorldRecord {
  id: "world";
  seed: number;
  dense: number;
  tiles: { id: TileKey; s: TileState }[];
}

const DB_NAME = "Infinite Minesweeper";
const DB_VERSION = 1;
const DB_STORE = "tileStore";

const CAMERA_KEY = "cam";
const ZOOM_KEY = "zoom";
const THEME_KEY = "theme";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
}

async function save(): Promise<void> {
  try {
    localStorage.setItem(CAMERA_KEY, JSON.stringify([camX, camY]));
    localStorage.setItem(ZOOM_KEY, JSON.stringify(zoom));
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));

    const db = await openDb();
    const transaction = db.transaction([DB_STORE], "readwrite");
    const dbStore = transaction.objectStore(DB_STORE);
    dbStore.clear();

    const compactTiles: { id: string; s: number }[] = [];
    stateMap.forEach((state, key) => compactTiles.push({ id: key, s: state }));

    dbStore.put({
      id: "world",
      dense: mineDensity,
      tiles: compactTiles,
      seed: globalSeed,
    } as WorldRecord);

    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch (err) {
    console.error("Could not save game data:", err);
  }
}

async function load(): Promise<void> {
  try {
    const lc = localStorage.getItem(CAMERA_KEY);
    if (lc) [camX, camY] = JSON.parse(lc);

    const lz = localStorage.getItem(ZOOM_KEY);
    if (lz) zoom = JSON.parse(lz);

    const lt = localStorage.getItem(THEME_KEY);
    if (lt) theme = JSON.parse(lt);

    const db = await openDb();
    const transaction = db.transaction([DB_STORE], "readonly");
    const dbStore = transaction.objectStore(DB_STORE);

    const dbResults = await new Promise<WorldRecord[]>((resolve, reject) => {
      const dbReq = dbStore.getAll();
      dbReq.onsuccess = () => resolve(dbReq.result);
      dbReq.onerror = () => reject(dbReq.error);
    });

    const dbd = dbResults.find((m) => m.id === "world");
    globalSeed = dbd?.seed ?? calcSeed();
    mineDensity = dbd?.dense ?? DEFAULT_DENSITY;

    stateMap.clear();
    if (dbd) {
      for (let i = 0, len = dbd.tiles.length; i < len; i++) {
        const record = dbd.tiles[i]!;
        stateMap.set(record.id, record.s);
      }
    }
  } catch (err) {
    console.error("Could not load save data:", err);
  }
}

//

canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
if (!canvas) throw new Error("Could not get gameCanvas element");
ctx = canvas.getContext("2d", { alpha: false })!;
if (!ctx) throw new Error("Browser does not support canvas");

await load();

{
  const activePointers: PointerEvent[] = [];

  let isPanning = false;
  let isLongPress = false;
  let isPinching = false;

  let startX = 0;
  let startY = 0;
  let dragX = 0;
  let dragY = 0;

  let initialPinchDistance = 0;
  let initialPinchZoom = 0;

  let longPressTimer: number | null = null;

  function doClearLongPress(): void {
    if (longPressTimer === null) return;
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  function doClick(e: PointerEvent): void {
    const [row, col] = calcScreenToTile(e.clientX, e.clientY);
    const { isInteractable: interactable } = getMeta(row, col);
    if (!interactable) return;

    const mine = getMine(row, col);
    const state = getState(row, col);

    const altClick =
      (e.pointerType === "mouse" && e.button === 2) || (e.pointerType === "touch" && !isLongPress);

    if (state === TILE_HIDE && (!altClick || stateMap.size === 0)) {
      const now = performance.now();
      if (mine) {
        updateTile(row, col, TILE_SHOW);
        animMap.set(calcTileKey(row, col), now + ANIMATION_DELAY);
      } else {
        doCascadeReveal(row, col, now);
      }
    } else if (state === TILE_SHOW) {
      const now = performance.now();
      doAnswersReveal(row, col, now);
    } else if (altClick) {
      updateTile(row, col, state === TILE_FLAG ? TILE_HIDE : TILE_FLAG);
    }

    save().catch(console.error);
  }

  function handleWheel(e: WheelEvent): void {
    const targetZoom = zoom * Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED);
    updateZoom(targetZoom, e.clientX, e.clientY);
  }

  function handlePointerDown(e: PointerEvent): void {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
    activePointers.push(e);

    isPanning = false;
    isLongPress = false;
    doClearLongPress();

    if (activePointers.length === 1 && !isPinching) {
      startX = e.clientX;
      startY = e.clientY;
      dragX = e.clientX - camX;
      dragY = e.clientY - camY;

      if (e.pointerType === "touch") {
        longPressTimer = setTimeout(() => {
          isLongPress = true;
          doClick(e);
        }, LONG_PRESS_DURATION);
      }
    } else if (activePointers.length === 2) {
      isPinching = true;
      initialPinchDistance = calcPointerDistance(activePointers[0]!, activePointers[1]!);
      initialPinchZoom = zoom;
    }
  }

  function handlePointerMove(e: PointerEvent): void {
    const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
    if (index !== -1) activePointers[index] = e;

    if (activePointers.length === 1) {
      if (isPanning) {
        camX = e.clientX - dragX;
        camY = e.clientY - dragY;
        isDirty = true;
      } else if (
        !isPinching &&
        Math.hypot(e.clientX - startX, e.clientY - startY) >= PAN_THRESHOLD
      ) {
        isPanning = true;
        doClearLongPress();
        canvas.style.cursor = "grabbing";
      }
    } else if (activePointers.length === 2) {
      doClearLongPress();
      const currentDistance = calcPointerDistance(activePointers[0]!, activePointers[1]!);
      if (initialPinchDistance > 0) {
        const midX = (activePointers[0]!.clientX + activePointers[1]!.clientX) / 2;
        const midY = (activePointers[0]!.clientY + activePointers[1]!.clientY) / 2;
        updateZoom(initialPinchZoom * (currentDistance / initialPinchDistance), midX, midY);
      }
    }
  }

  function handlePointerEnd(e: PointerEvent): void {
    const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
    if (index !== -1) activePointers.splice(index, 1);
    doClearLongPress();

    if (activePointers.length > 0 || isLongPress) return;
    if (isPinching) {
      isPinching = false;
      return;
    }
    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = "default";
      return;
    }

    doClick(e);
  }

  function doPreventDefault(e: Event): void {
    e.preventDefault();
  }

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]!;
    canvas.width = entry.contentRect.width;
    canvas.height = entry.contentRect.height;
    isDirty = true;
  });
  resizeObserver.observe(canvas);

  canvas.addEventListener("wheel", handleWheel, { passive: true });

  canvas.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);

  canvas.addEventListener("contextmenu", doPreventDefault);
}

void document.fonts.ready.then(() => {
  isDirty = true;
  requestAnimationFrame(doTick);
});

const themeSelect = document.getElementById("themeSelect") as HTMLSelectElement | null;
if (themeSelect) {
  themeSelect.addEventListener("change", () => {
    theme = Number(themeSelect.value);
    isDirty = true;
    save().catch(console.error);
  });

  for (let i = 0; i < THEME_DATA.length; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.text = THEME_DATA[i]!.name;
    themeSelect.appendChild(option);
  }

  themeSelect.value = String(theme);
} else console.warn("Could not get themeSelect element");

const restartButton = document.getElementById("restartButton") as HTMLButtonElement | null;
if (restartButton) {
  restartButton.onclick = () => {
    stateMap.clear();
    mineMap.clear();
    metaMap.clear();
    animMap.clear();

    globalSeed = calcSeed();
    mineDensity = DEFAULT_DENSITY;

    camX = 0;
    camY = 0;

    isDirty = true;
    save().catch(console.error);
  };
} else console.warn("Could not get restartButton element");
