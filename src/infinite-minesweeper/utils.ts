import { DB_NAME, DB_VERSION, DB_STORE } from "./constants";
import type { TileKey } from "./types";

export function number2Colour(n: number): string {
  const hue = (360 / 8) * n;
  return `oklch(0.8 0.35 ${hue % 360})`;
}

export function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function coord2Hash(row: number, col: number, seed: number): number {
  let h = seed ^ (row * 73856093) ^ (col * 19349663);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) | 0;
}

export function genSeed(): number {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const array = new Int32Array(1);
    window.crypto.getRandomValues(array);
    return array[0]!;
  }
  return Math.floor(Math.random() * 0xffffffff) | 0;
}

export function preventDefault(e: Event): void {
  e.preventDefault();
}

export function tileToKey(row: number, col: number): TileKey {
  return `${row}_${col}` as TileKey;
}

export function getPointerDistance(p1: PointerEvent, p2: PointerEvent): number {
  const dx = p1.clientX - p2.clientX;
  const dy = p1.clientY - p2.clientY;
  return Math.hypot(dx, dy);
}

export function openDb(): Promise<IDBDatabase> {
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

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
