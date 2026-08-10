export type TileKey = `${number}_${number}` & { readonly __brand: unique symbol };
export type TileState = 0 | 1 | 2;

export type TileRecord = { id: "tiles"; data: { id: TileKey; s: TileState }[] };
export type GenRecord = { key: "gen"; seed: number; density: number };
export type CameraRecord = { key: "camera"; offset: [number, number]; zoom: number };
