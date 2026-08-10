import { Canvas } from "./canvas";
import { CONSTANTS } from "./constants";
import { State } from "./state";
import type { TileKey } from "./types";
import { Utils } from "./utils";

async function countAsyncNeighbouringMines(
  row: number,
  col: number,
): Promise<{ mines: number; flags: number; revealedMines: number }> {
  let mines = 0;
  let flags = 0;
  let revealedMines = 0;

  for (let i = 0; i < CONSTANTS.NEIGHBOR_OFFSETS.length; i++) {
    const [dr, dc] = CONSTANTS.NEIGHBOR_OFFSETS[i]!;
    const nr = row + dr;
    const nc = col + dc;

    const [state] = State.getTile(nr, nc);
    const hasMine = await State.getMineStatusAsync(nr, nc);

    if (hasMine) mines++;
    if (state === CONSTANTS.TILE_FLAGGED) flags++;
    if (state === CONSTANTS.TILE_REVEALED && hasMine) revealedMines++;
  }

  return { mines, flags, revealedMines };
}

async function executeCascade(
  startRow: number,
  startCol: number,
  now: number,
  groupState: { group: number; groupIndex: number } = { group: 0, groupIndex: 0 },
): Promise<void> {
  const startKey = Utils.getTileKey(startRow, startCol);
  const visited = new Set<TileKey>();
  const queue: [number, number][] = [[startRow, startCol]];
  const queued = new Set<TileKey>([startKey]);

  let index = 0;

  while (index < queue.length) {
    const [row, col] = queue[index++]!;
    const key = Utils.getTileKey(row, col);

    if (visited.has(key)) continue;
    visited.add(key);

    const [state, hasMine] = await State.getTileAsync(row, col);

    if (state === CONSTANTS.TILE_HIDDEN || (state === CONSTANTS.TILE_FLAGGED && !hasMine)) {
      State.setTile(row, col, CONSTANTS.TILE_REVEALED);
      State.setAnimation(row, col, now + groupState.group * CONSTANTS.GROUP_GAP);

      groupState.groupIndex++;
      if (groupState.groupIndex % CONSTANTS.GROUP_SIZE === 0) {
        groupState.group++;
        groupState.groupIndex = 0;
      }
    }

    const { mines } = await countAsyncNeighbouringMines(row, col);

    if (mines === 0) {
      for (let i = 0; i < CONSTANTS.NEIGHBOR_OFFSETS.length; i++) {
        const [dr, dc] = CONSTANTS.NEIGHBOR_OFFSETS[i]!;
        const nr = row + dr;
        const nc = col + dc;
        const neighborKey = Utils.getTileKey(nr, nc);

        if (!visited.has(neighborKey) && !queued.has(neighborKey)) {
          queued.add(neighborKey);
          queue.push([nr, nc]);
        }
      }
    }
  }
}

async function answersReveal(row: number, col: number): Promise<void> {
  const { mines, flags, revealedMines } = await countAsyncNeighbouringMines(row, col);
  if (mines !== flags + revealedMines && mines !== revealedMines) return;

  const now = performance.now();
  const groupState = { group: 0, groupIndex: 0 };

  const [neighbours] = Utils.getNeighbouringTiles(row, col);
  for (let i = 0, len = neighbours.length; i < len; i++) {
    const [state, , [nr, nc]] = neighbours[i]!;
    if (state === CONSTANTS.TILE_HIDDEN || state === CONSTANTS.TILE_FLAGGED) {
      await executeCascade(nr, nc, now, groupState);
    }
  }
}

export const Logic = {
  async revealTile(row: number, col: number): Promise<void> {
    const [state, hasMine] = await State.getTileAsync(row, col);
    if (state === CONSTANTS.TILE_FLAGGED) return;

    if (hasMine) {
      State.setTile(row, col, CONSTANTS.TILE_REVEALED);
      Canvas.requestDraw();
      return;
    }

    if (state === CONSTANTS.TILE_REVEALED) {
      await answersReveal(row, col);
    } else {
      await executeCascade(row, col, performance.now());
    }

    Canvas.requestDraw();
  },

  async flagTile(row: number, col: number): Promise<void> {
    const [state, hasMine] = State.getTile(row, col);

    if (state === CONSTANTS.TILE_REVEALED) {
      if (hasMine) return;
      await answersReveal(row, col);
    } else if (state === CONSTANTS.TILE_FLAGGED) {
      State.setTile(row, col, CONSTANTS.TILE_HIDDEN);
    } else {
      State.setTile(row, col, CONSTANTS.TILE_FLAGGED);
    }

    Canvas.requestDraw();
  },
};
