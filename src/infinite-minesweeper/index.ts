import {
  DB_STORE,
  DEFAULT_DENSITY,
  TILE_HIDE,
  NEIGHBOUR_OFFSETS,
  TILE_SHOW,
  TILE_FLAG,
  TILE_SIZE,
  CANVAS_ID,
  LONG_PRESS_DURATION,
  PAN_THRESHOLD,
  LOW_DETAIL_ZOOM,
  WHEEL_ZOOM_SPEED,
  MIN_ZOOM,
  MAX_ZOOM,
  ANIMATION_DELAY,
  ANIMATION_DURATION,
  BORDER_WIDTH,
  BORDER_RADIUS,
  THEME,
  VS15,
  FONT_SIZE,
  FONT_FAMILY,
  CAMERA_KEY,
  ZOOM_KEY,
  THEME_KEY,
} from "./constants";
import type { TileKey, TileState, TileMetaData, OneToEight, DBRecord } from "./types";
import {
  tileToKey,
  coord2Hash,
  mulberry32,
  getPointerDistance,
  preventDefault,
  easeOutQuad,
  openDb,
  genSeed,
} from "./utils";

class IMSEngine {
  public onDirty: (() => void) | null = null;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private removeListeners: (() => void) | null = null;

  private globalSeed = 0;
  private mineDensity = DEFAULT_DENSITY;

  private zoom = 1;
  private camX = 0;
  private camY = 0;

  private isDirty = true;
  private theme = false;

  private tileMap = new Map<TileKey, TileState>();
  private mineCache = new Map<TileKey, boolean>();
  private tileMetaDataCache = new Map<TileKey, TileMetaData>();
  private animations = new Map<TileKey, number>();

  private getTile(row: number, col: number): TileState {
    return this.tileMap.get(tileToKey(row, col)) ?? TILE_HIDE;
  }

  private setTile(row: number, col: number, newState: TileState) {
    const key = tileToKey(row, col);
    const currentState = this.tileMap.get(key) ?? TILE_HIDE;
    if (newState === currentState) return;

    if (newState === TILE_HIDE) {
      this.tileMap.delete(key);
    } else {
      this.tileMap.set(key, newState);
    }

    this.tileMetaDataCache.delete(key);
    for (let i = 0; i < NEIGHBOUR_OFFSETS.length; i++) {
      const [or, oc] = NEIGHBOUR_OFFSETS[i]!;
      this.tileMetaDataCache.delete(tileToKey(row + or, col + oc));
    }
    this.isDirty = true;
  }

  private getHasMine(row: number, col: number): boolean {
    if (Math.abs(row) <= 1 && Math.abs(col) <= 1) return false;

    const key = tileToKey(row, col);
    let isMine = this.mineCache.get(key);

    if (isMine === undefined) {
      isMine = mulberry32(coord2Hash(row, col, this.globalSeed)) < this.mineDensity;
      this.mineCache.set(key, isMine);
    }

    return isMine;
  }

  private getTileMetaData(row: number, col: number): TileMetaData {
    const key = tileToKey(row, col);
    let metaData = this.tileMetaDataCache.get(key);

    if (metaData === undefined) {
      metaData = { nearbyMines: 0, flags: 0, revealedMines: 0 };

      for (let i = 0; i < NEIGHBOUR_OFFSETS.length; i++) {
        const [or, oc] = NEIGHBOUR_OFFSETS[i]!;
        const nr = row + or;
        const nc = col + oc;

        if (this.getHasMine(nr, nc)) {
          metaData.nearbyMines++;
          if (this.getTile(nr, nc) === TILE_SHOW) {
            metaData.revealedMines++;
          }
        }

        if (this.getTile(nr, nc) === TILE_FLAG) {
          metaData.flags++;
        }
      }

      this.tileMetaDataCache.set(key, metaData);
    }

    return metaData;
  }

  private isInteractable(row: number, col: number): boolean {
    if (row === 0 && col === 0) return true;

    for (let i = 0; i < NEIGHBOUR_OFFSETS.length; i++) {
      const [or, oc] = NEIGHBOUR_OFFSETS[i]!;
      if (this.getTile(row + or, col + oc) === TILE_SHOW) return true;
    }

    return false;
  }

  private screenToTile(clientX: number, clientY: number): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left - this.canvas.width / 2;
    const canvasY = clientY - rect.top - this.canvas.height / 2;
    const ts = TILE_SIZE * this.zoom;

    return [
      Math.floor(canvasY / ts - this.camY / ts + 0.5),
      Math.floor(canvasX / ts - this.camX / ts + 0.5),
    ];
  }

  public constructor() {
    const canvas = document.getElementById(CANVAS_ID);
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error(`Could not get a valid #${CANVAS_ID} canvas element`);
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;

    void this.load().then(() => {
      this.setupCanvas();
      this.startTick();
    });
  }

  private setupCanvas() {
    const activePointers: PointerEvent[] = [];
    let startX = 0,
      startY = 0,
      dragX = 0,
      dragY = 0;
    let isPanning = false,
      isLongPress = false,
      isPinching = false;
    let initialPinchDistance = 0,
      initialPinchZoom = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;

    this.canvas.style.touchAction = "none";

    const clearLongPress = () => {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
      activePointers.push(e);

      isPanning = false;
      isLongPress = false;
      clearLongPress();

      if (activePointers.length === 1 && !isPinching) {
        startX = e.clientX;
        startY = e.clientY;
        dragX = e.clientX - this.camX;
        dragY = e.clientY - this.camY;

        if (e.pointerType === "touch") {
          longPressTimer = setTimeout(() => {
            isLongPress = true;
            click(e);
          }, LONG_PRESS_DURATION);
        }
      } else if (activePointers.length === 2) {
        isPinching = true;
        initialPinchDistance = getPointerDistance(activePointers[0]!, activePointers[1]!);
        initialPinchZoom = this.zoom;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
      if (index !== -1) activePointers[index] = e;

      if (activePointers.length === 1) {
        if (isPanning) {
          this.camX = e.clientX - dragX;
          this.camY = e.clientY - dragY;
          this.isDirty = true;
        } else if (
          !isPinching &&
          Math.hypot(e.clientX - startX, e.clientY - startY) >= PAN_THRESHOLD
        ) {
          isPanning = true;
          clearLongPress();
          this.canvas.style.cursor = "grabbing";
        }
      } else if (activePointers.length === 2) {
        clearLongPress();
        const currentDistance = getPointerDistance(activePointers[0]!, activePointers[1]!);
        if (initialPinchDistance > 0) {
          const midX = (activePointers[0]!.clientX + activePointers[1]!.clientX) / 2;
          const midY = (activePointers[0]!.clientY + activePointers[1]!.clientY) / 2;
          this.updateZoom(initialPinchZoom * (currentDistance / initialPinchDistance), midX, midY);
        }
      }
    };

    const handlePointerEnd = (e: PointerEvent) => {
      const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
      if (index !== -1) activePointers.splice(index, 1);
      clearLongPress();

      if (activePointers.length > 0 || isLongPress) return;
      if (isPinching) {
        isPinching = false;
        return;
      }
      if (isPanning) {
        isPanning = false;
        this.canvas.style.cursor = "default";
        return;
      }

      click(e);
    };

    const click = (e: PointerEvent) => {
      if (this.zoom <= LOW_DETAIL_ZOOM) return;

      const [r, c] = this.screenToTile(e.clientX, e.clientY);
      if (!this.isInteractable(r, c)) return;

      const state = this.getTile(r, c);
      const altClick =
        (e.pointerType === "mouse" && e.button === 2) ||
        (e.pointerType === "touch" && !isLongPress);
      const now = performance.now();

      if (altClick && state !== TILE_SHOW) {
        this.setTile(r, c, state === TILE_FLAG ? TILE_HIDE : TILE_FLAG);
      } else if (state === TILE_HIDE && !altClick) {
        this.cascadeReveal(r, c, now);
      } else if (state === TILE_SHOW) {
        this.answersReveal(r, c, now);
      }

      void this.save();
    };

    const handleWheel = (e: WheelEvent) => {
      this.updateZoom(this.zoom * Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED), e.clientX, e.clientY);
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]!;
      this.canvas.width = entry.contentRect.width;
      this.canvas.height = entry.contentRect.height;
      this.isDirty = true;
    });

    observer.observe(this.canvas);
    this.canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    this.canvas.addEventListener("wheel", handleWheel, { passive: true });
    this.canvas.addEventListener("contextmenu", preventDefault);

    this.removeListeners = () => {
      observer.disconnect();
      this.canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      this.canvas.removeEventListener("wheel", handleWheel);
      this.canvas.removeEventListener("contextmenu", preventDefault);
    };
  }

  public removeInteractivity() {
    this.removeListeners?.();
  }

  private updateZoom(newZoom: number, clientX: number, clientY: number) {
    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    if (this.zoom === newZoom) return;

    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left - rect.width / 2;
    const localY = clientY - rect.top - rect.height / 2;

    this.camX = localX - ((localX - this.camX) * newZoom) / this.zoom;
    this.camY = localY - ((localY - this.camY) * newZoom) / this.zoom;
    this.zoom = newZoom;
    this.isDirty = true;
  }

  private cascadeReveal(startRow: number, startCol: number, now: number) {
    const visited = new Set<TileKey>();
    const queue: [number, number][] = [[startRow, startCol]];
    const queued = new Set<TileKey>([tileToKey(startRow, startCol)]);

    let index = 0;
    while (index < queue.length) {
      const [row, col] = queue[index++]!;
      const key = tileToKey(row, col);

      if (visited.has(key)) continue;
      visited.add(key);

      const state = this.getTile(row, col);
      const hasMine = this.getHasMine(row, col);

      if (state === TILE_HIDE || (state === TILE_FLAG && !hasMine)) {
        this.setTile(row, col, TILE_SHOW);
        this.animations.set(
          key,
          now + Math.max(Math.abs(row - startRow), Math.abs(col - startCol)) * ANIMATION_DELAY,
        );
      }

      if (!hasMine && this.getTileMetaData(row, col).nearbyMines === 0) {
        for (let i = 0; i < NEIGHBOUR_OFFSETS.length; i++) {
          const [or, oc] = NEIGHBOUR_OFFSETS[i]!;
          const nk = tileToKey(row + or, col + oc);
          if (!visited.has(nk) && !queued.has(nk)) {
            queued.add(nk);
            queue.push([row + or, col + oc]);
          }
        }
      }
    }
  }

  private answersReveal(startRow: number, startCol: number, now: number) {
    const { nearbyMines, flags, revealedMines } = this.getTileMetaData(startRow, startCol);
    if (nearbyMines !== flags + revealedMines) return;

    for (let i = 0; i < NEIGHBOUR_OFFSETS.length; i++) {
      const [or, oc] = NEIGHBOUR_OFFSETS[i]!;
      const nr = startRow + or;
      const nc = startCol + oc;
      if (this.getTile(nr, nc) !== TILE_SHOW) {
        this.cascadeReveal(nr, nc, now);
      }
    }
  }

  private tick = () => {
    const now = performance.now();

    if (this.animations.size > 0) {
      this.animations.forEach((animStart, key) => {
        if (now - animStart >= 0) {
          this.isDirty = true;
          if (now - animStart >= ANIMATION_DURATION) {
            this.animations.delete(key);
          }
        }
      });
    }

    if (this.isDirty) {
      this.draw();
      this.onDirty?.();
    }

    this.animationId = requestAnimationFrame(this.tick);
  };

  public startTick() {
    if (this.animationId !== null) return;
    this.animationId = requestAnimationFrame(this.tick);
  }

  public stopTick() {
    if (this.animationId === null) return;
    cancelAnimationFrame(this.animationId);
    this.animationId = null;
  }

  private draw() {
    this.isDirty = false;
    const now = performance.now();
    const { height: ch, width: cw } = this.canvas;

    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.save();

    const ts = TILE_SIZE * this.zoom;
    const bw = BORDER_WIDTH * this.zoom;
    const br = BORDER_RADIUS * this.zoom;

    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    const centreX = -this.camX / ts;
    const centreY = -this.camY / ts;
    const renderDetails = this.zoom > LOW_DETAIL_ZOOM;

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

        this.ctx.save();

        let tileColour: string = THEME.TILE;
        let textColour: string = THEME.TEXT;
        let text: string | undefined;
        let textScale = 1;
        const tileState = this.getTile(row, col);

        if (row === 0 && col === 0 && this.tileMap.size === 0) {
          text = "Click!";
          textScale = 0.5;
        } else if (tileState === TILE_SHOW) {
          if (this.getHasMine(row, col)) {
            text = `💥${VS15}`;
            textScale = 1.5;
          } else {
            const nearbyMines = this.getTileMetaData(row, col).nearbyMines;
            const numberColour = THEME[`NUMBER_${Math.max(1, nearbyMines) as OneToEight}`];
            tileColour = this.theme ? THEME.BORDER : numberColour;
            if (nearbyMines > 0) {
              textColour = this.theme ? numberColour : THEME.TEXT_DARK;
              text = String(nearbyMines);
            }
          }
        } else if (tileState === TILE_FLAG) {
          text = `🚩${VS15}`;
          textScale = 1.5;
        }

        this.ctx.fillStyle = THEME.BORDER;
        this.ctx.fillRect(x, y, w, h);

        let scale = 1;
        const animStart = this.animations.get(tileToKey(row, col));
        if (animStart !== undefined) {
          scale = easeOutQuad(Math.max(0, Math.min(1, (now - animStart) / ANIMATION_DURATION)));
        }

        if (scale < 1) {
          this.ctx.fillStyle = THEME.TILE;
          if (renderDetails) {
            this.ctx.beginPath();
            this.ctx.roundRect(x + bw, y + bw, w - bw * 2, h - bw * 2, br);
            this.ctx.fill();
          } else {
            this.ctx.fillRect(x, y, w, h);
          }
        }

        this.ctx.fillStyle = this.isInteractable(row, col)
          ? tileColour
          : `color-mix(in srgb, ${tileColour} 20%, transparent)`;

        this.ctx.save();
        this.ctx.translate(x + w / 2, y + h / 2);
        this.ctx.scale(scale, scale);

        const localX = -w / 2;
        const localY = -h / 2;

        if (renderDetails) {
          this.ctx.beginPath();
          this.ctx.roundRect(localX + bw, localY + bw, w - bw * 2, h - bw * 2, br);
          this.ctx.fill();
        } else {
          this.ctx.fillRect(localX, localY, w, h);
        }

        if (text && renderDetails) {
          this.ctx.font = `bold ${FONT_SIZE * textScale * this.zoom}px ${FONT_FAMILY}`;
          this.ctx.fillStyle = textColour;
          this.ctx.fillText(text, 0, 3 * this.zoom);
        }

        this.ctx.restore();
        this.ctx.restore();
      }
    }

    this.ctx.restore();
  }

  public async save() {
    try {
      localStorage.setItem(CAMERA_KEY, JSON.stringify([this.camX, this.camY]));
      localStorage.setItem(ZOOM_KEY, JSON.stringify(this.zoom));
      localStorage.setItem(THEME_KEY, JSON.stringify(this.theme));

      const db = await openDb();
      const transaction = db.transaction([DB_STORE], "readwrite");
      const dbStore = transaction.objectStore(DB_STORE);
      dbStore.clear();

      const compactTiles: { id: string; s: number }[] = [];
      this.tileMap.forEach((state, key) => compactTiles.push({ id: key, s: state }));

      dbStore.put({
        id: "db",
        tiles: compactTiles,
        seed: this.globalSeed,
        dense: this.mineDensity,
      } as DBRecord);

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } catch (err) {
      console.error("Could not save game data:", err);
    }
  }

  public async load() {
    try {
      const cam = localStorage.getItem(CAMERA_KEY);
      if (cam) [this.camX, this.camY] = JSON.parse(cam);

      const zoom = localStorage.getItem(ZOOM_KEY);
      if (zoom) this.zoom = JSON.parse(zoom);

      const theme = localStorage.getItem(THEME_KEY);
      if (theme) this.theme = JSON.parse(theme);

      const db = await openDb();
      const transaction = db.transaction([DB_STORE], "readonly");
      const dbStore = transaction.objectStore(DB_STORE);

      const dbResults = await new Promise<DBRecord[]>((resolve, reject) => {
        const dbReq = dbStore.getAll();
        dbReq.onsuccess = () => resolve(dbReq.result);
        dbReq.onerror = () => reject(dbReq.error);
      });

      const dbd = dbResults.find((m) => m.id === "db");
      this.globalSeed = dbd?.seed ?? genSeed();
      this.mineDensity = dbd?.dense ?? DEFAULT_DENSITY;

      this.tileMap.clear();
      if (dbd) {
        for (let i = 0, len = dbd.tiles.length; i < len; i++) {
          const record = dbd.tiles[i]!;
          this.tileMap.set(record.id, record.s);
        }
      }
    } catch (err) {
      console.error("Could not load save data:", err);
    }
  }

  public restart(mineDensity: number = DEFAULT_DENSITY) {
    this.globalSeed = genSeed();
    this.mineDensity = mineDensity;
    this.camX = 0;
    this.camY = 0;

    this.tileMap.clear();
    this.mineCache.clear();
    this.tileMetaDataCache.clear();
    this.isDirty = true;
  }

  public toggleTheme() {
    this.theme = !this.theme;
    this.isDirty = true;
  }
}

declare global {
  interface Window {
    IM$?: IMSEngine;
  }
}

const IMS = new IMSEngine();
window.IM$ = IMS;
