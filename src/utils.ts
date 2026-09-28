import {
  FINISHED_BIT,
  CAN_INTERACT_BIT,
  NEARBY_MINES_MASK,
  BASE_CHUNK_WORLD,
  MAX_LEVEL,
  MIN_LEVEL,
  TARGET_SCREEN_PX,
} from "./constants";
import type { ChunkKey } from "./types";

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

export function packTileKey(x: number, y: number): number {
  return ((x & 0xffff) << 16) | (y & 0xffff);
}

export function hash2D(x: number, y: number, seed: number): number {
  let h = seed ^ Math.imul(y, 73856093) ^ Math.imul(x, 19349663);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

export function isFinished(data: number): boolean {
  return (data & FINISHED_BIT) === FINISHED_BIT;
}

export function getCanInteract(data: number): boolean {
  return (data & CAN_INTERACT_BIT) === CAN_INTERACT_BIT;
}

export function getNearbyMines(data: number): number {
  return (data & NEARBY_MINES_MASK) >> 2;
}

export function pickLevel(zoom: number, dpr: number): number {
  return Math.max(
    MIN_LEVEL,
    Math.min(MAX_LEVEL, Math.round(Math.log2(TARGET_SCREEN_PX / dpr / (BASE_CHUNK_WORLD * zoom)))),
  );
}

export function chunkWorldSize(level: number): number {
  return BASE_CHUNK_WORLD * 2 ** level;
}

export function packKey(level: number, cx: number, cy: number): ChunkKey {
  return `${level}:${cx}:${cy}`;
}

export function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = (): void => resolve(req.result);
    req.onerror = (): void => reject(req.error);
  });
}
