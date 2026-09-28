export type TileState = 0 | 1 | 2;

export type ChunkKey = `${number}:${number}:${number}`;

export interface ChunkEntry {
  level: number;
  cx: number;
  cy: number;
  bitmap: ImageBitmap;
}

export type SaveData = [
  seed: number,
  mineDensity: number,
  started: boolean,
  startX: number,
  startY: number,
  camX: number,
  camY: number,
  zoom: number,
];
