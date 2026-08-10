import { CONSTANTS } from "./constants";
import { State } from "./state";
import type { CameraRecord, GenRecord, TileRecord } from "./types";
import { Utils } from "./utils";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONSTANTS.DB_NAME, CONSTANTS.DB_VERSION);

    request.onupgradeneeded = (event): void => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(CONSTANTS.TILE_STORE)) {
        db.createObjectStore(CONSTANTS.TILE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CONSTANTS.META_STORE)) {
        db.createObjectStore(CONSTANTS.META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = (event): void => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event): void => reject((event.target as IDBOpenDBRequest).error);
  });
}

export const Store = {
  async saveGame(): Promise<void> {
    try {
      const db = await openDb();
      const transaction = db.transaction([CONSTANTS.TILE_STORE, CONSTANTS.META_STORE], "readwrite");

      const tileStore = transaction.objectStore(CONSTANTS.TILE_STORE);
      const metaStore = transaction.objectStore(CONSTANTS.META_STORE);

      tileStore.clear();

      const compactTiles: { id: string; s: number }[] = [];
      State.forTiles((state, key) => {
        compactTiles.push({ id: key, s: state });
      });

      tileStore.put({ id: "tiles", data: compactTiles } as TileRecord);
      metaStore.put({ key: "gen", seed: State.seed, density: State.density } as GenRecord);
      metaStore.put({ key: "camera", offset: State.viewPoint, zoom: State.zoom } as CameraRecord);

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = (): void => resolve();
        transaction.onerror = (): void => reject(transaction.error);
        transaction.onabort = (): void => reject(transaction.error);
      });
    } catch (err) {
      console.error("Could not save game data:", err);
    }
  },

  async loadGame(): Promise<void> {
    try {
      const db = await openDb();
      const transaction = db.transaction([CONSTANTS.TILE_STORE, CONSTANTS.META_STORE], "readonly");

      const tileStore = transaction.objectStore(CONSTANTS.TILE_STORE);
      const metaStore = transaction.objectStore(CONSTANTS.META_STORE);

      const [tileResults, metaResults] = await new Promise<[TileRecord[], (GenRecord | CameraRecord)[]]>(
        (resolve, reject) => {
          let tiles: TileRecord[] = [];
          let meta: (GenRecord | CameraRecord)[] = [];

          const tReq = tileStore.getAll();
          const mReq = metaStore.getAll();

          tReq.onsuccess = (): void => {
            tiles = tReq.result;
          };
          mReq.onsuccess = (): void => {
            meta = mReq.result;
          };

          transaction.oncomplete = (): void => resolve([tiles, meta]);
          transaction.onerror = (): void => reject(transaction.error);
          transaction.onabort = (): void => reject(transaction.error);
        },
      );

      const gen = metaResults.find((m) => m.key === "gen");
      State.seed = gen?.seed ?? Utils.getRandomSeed();
      State.density = gen?.density ?? CONSTANTS.DEFAULT_DENSITY;

      const tiles = tileResults.find((m) => m.id === "tiles");
      State.clearTiles();
      if (tiles) {
        for (let i = 0, len = tiles.data.length; i < len; i++) {
          const record = tiles.data[i]!;
          State.overrideTile(record.id, record.s);
        }
      }

      const camera = metaResults.find((m) => m.key === "camera");
      State.viewPoint = camera?.offset ?? [0, 0];
      State.zoom = camera?.zoom ?? 1;
    } catch (err) {
      console.error("Could not load save data:", err);
    }
  },
};
