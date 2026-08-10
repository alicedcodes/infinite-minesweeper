import { Canvas } from "./canvas";
import { CONSTANTS } from "./constants";
import type { TileKey, TileState } from "./types";
import { Utils } from "./utils";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const tileMap = new Map<TileKey, TileState>();
const animationMap = new Map<TileKey, number>();
const mineCache = new Map<TileKey, boolean>();

const worker = new Worker(new URL("./generator.worker.ts", import.meta.url), {
  type: "module",
});

let messageId = 0;
const pendingRequests = new Map<number, (hasMine: boolean) => void>();

worker.onmessage = (e: MessageEvent<{ id: number; hasMine: boolean }>): void => {
  const { id, hasMine } = e.data;
  const resolve = pendingRequests.get(id);
  if (resolve) {
    resolve(hasMine);
    pendingRequests.delete(id);
  }

  Canvas.requestDraw();
};

let gameSeed = 0;
let mineDensity: number = CONSTANTS.DEFAULT_DENSITY;
let cameraX = 0;
let cameraY = 0;
let cameraZoom = 1;

export const State = {
  getTile(row: number, col: number): [state: TileState, hasMine: boolean] {
    const key = Utils.getTileKey(row, col);
    const state = tileMap.get(key) ?? CONSTANTS.TILE_HIDDEN;

    if (Math.abs(row) <= 1 && Math.abs(col) <= 1) {
      return [state, false];
    }

    const hasMine = mineCache.get(key) ?? false;
    if (!mineCache.has(key)) {
      State.preloadTile(row, col);
    }

    return [state, hasMine];
  },

  peekTileState(row: number, col: number): TileState {
    const key = Utils.getTileKey(row, col);
    return tileMap.get(key) ?? CONSTANTS.TILE_HIDDEN;
  },

  async getTileAsync(row: number, col: number): Promise<[TileState, boolean]> {
    const key = Utils.getTileKey(row, col);
    const state = tileMap.get(key) ?? CONSTANTS.TILE_HIDDEN;

    if (Math.abs(row) <= 1 && Math.abs(col) <= 1) {
      return [state, false];
    }

    let hasMine = mineCache.get(key);
    if (hasMine === undefined) {
      hasMine = await new Promise<boolean>((resolve) => {
        const id = messageId++;
        pendingRequests.set(id, resolve);
        worker.postMessage({ id, row, col, seed: gameSeed, density: mineDensity });
      });
      mineCache.set(key, hasMine);
    }

    return [state, hasMine];
  },

  async getMineStatusAsync(row: number, col: number): Promise<boolean> {
    const key = Utils.getTileKey(row, col);
    if (Math.abs(row) <= 1 && Math.abs(col) <= 1) return false;

    let hasMine = mineCache.get(key);
    if (hasMine !== undefined) return hasMine;

    hasMine = await new Promise<boolean>((resolve) => {
      const id = messageId++;
      pendingRequests.set(id, resolve);
      worker.postMessage({ id, row, col, seed: gameSeed, density: mineDensity });
    });
    mineCache.set(key, hasMine);
    return hasMine;
  },

  preloadTile(row: number, col: number): void {
    const key = Utils.getTileKey(row, col);
    if (mineCache.has(key) || pendingRequests.size > 20) return;

    const id = messageId++;
    pendingRequests.set(id, (hasMine) => {
      mineCache.set(key, hasMine);
    });
    worker.postMessage({ id, row, col, seed: gameSeed, density: mineDensity });
  },

  setTile(row: number, col: number, newState: TileState): void {
    const key = Utils.getTileKey(row, col);
    if (newState === CONSTANTS.TILE_HIDDEN) {
      tileMap.delete(key);
    } else {
      tileMap.set(key, newState);
    }
  },

  clearTiles(): void {
    tileMap.clear();
    animationMap.clear();
    mineCache.clear();
  },

  overrideTile(key: TileKey, state: TileState): void {
    if (state === CONSTANTS.TILE_HIDDEN) {
      tileMap.delete(key);
    } else {
      tileMap.set(key, state);
    }
  },

  forTiles(cb: (state: TileState, key: TileKey) => void): void {
    tileMap.forEach((state, key) => cb(state, key));
  },

  get seed(): number {
    return gameSeed;
  },
  set seed(newValue: number) {
    gameSeed = newValue;
    mineCache.clear();
  },

  get density(): number {
    return mineDensity;
  },
  set density(newValue: number) {
    mineDensity = newValue;
    mineCache.clear();
  },

  getAnimation(row: number, col: number): number | null {
    return animationMap.get(Utils.getTileKey(row, col)) ?? null;
  },

  setAnimation(row: number, col: number, start: number): void {
    animationMap.set(Utils.getTileKey(row, col), start);
  },

  updateAnimations(now: number): void {
    if (animationMap.size === 0) return;
    for (const [key, start] of animationMap.entries()) {
      if (now - start >= CONSTANTS.ANIMATION_DURATION) {
        animationMap.delete(key);
      }
    }
  },

  get viewPoint(): [x: number, y: number] {
    return [cameraX, cameraY];
  },
  set viewPoint(newValue: [x: number, y: number]) {
    [cameraX, cameraY] = newValue;
  },
  get zoom(): number {
    return cameraZoom;
  },
  set zoom(newValue: number) {
    cameraZoom = clamp(newValue, CONSTANTS.MIN_ZOOM, CONSTANTS.MAX_ZOOM);
  },
};
