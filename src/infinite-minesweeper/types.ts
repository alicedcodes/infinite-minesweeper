export type OneToEight = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type TileKey = `${number}_${number}`;
export type TileState = 0 | 1 | 2;
export type TileMetaData = { nearbyMines: number; flags: number; revealedMines: number };

export interface DBRecord {
  id: "db";
  seed: number;
  dense: number;
  tiles: { id: TileKey; s: TileState }[];
}
