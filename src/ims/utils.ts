import { CONSTANTS } from "./constants";
import { State } from "./state";
import type { TileKey, TileState } from "./types";

export const Utils = {
  getTileKey(row: number, col: number): TileKey {
    return `${row}_${col}` as TileKey;
  },

  getRandomSeed(): number {
    return Math.floor(Math.random() * 2147483647);
  },

  getNeighbouringTiles(
    row: number,
    col: number,
  ): [
    neighbouringTiles: [state: TileState, hasMine: boolean, [row: number, col: number]][],
    mines: number,
    flags: number,
    revealed: number,
    revealedMines: number,
  ] {
    const neighbouringTiles: [TileState, boolean, [number, number]][] = [];
    let mines = 0;
    let flags = 0;
    let revealed = 0;
    let revealedMines = 0;

    for (let i = 0; i < CONSTANTS.NEIGHBOR_OFFSETS.length; i++) {
      const [dr, dc] = CONSTANTS.NEIGHBOR_OFFSETS[i]!;
      const nr = row + dr;
      const nc = col + dc;
      const [state, hasMine] = State.getTile(nr, nc);

      if (state === CONSTANTS.TILE_REVEALED) {
        revealed++;
        if (hasMine) revealedMines++;
      } else if (state === CONSTANTS.TILE_FLAGGED) {
        flags++;
      }

      if (hasMine) {
        mines++;
      }

      neighbouringTiles.push([state, hasMine, [nr, nc]]);
    }

    return [neighbouringTiles, mines, flags, revealed, revealedMines];
  },
};
