import { CONSTANTS } from "./constants";
import { Logic } from "./logic";
import { State } from "./state";
import { Utils } from "./utils";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function getTileBox(
  row: number,
  col: number,
  centreX: number,
  centreY: number,
  tileStartX: number,
  tileStartY: number,
  tileSize: number,
): [x: number, y: number, width: number, height: number] {
  const x1 = Math.floor(centreX + (col - tileStartX) * tileSize - tileSize / 2);
  const x2 = Math.floor(centreX + (col + 1 - tileStartX) * tileSize - tileSize / 2);
  const y1 = Math.floor(centreY + (row - tileStartY) * tileSize - tileSize / 2);
  const y2 = Math.floor(centreY + (row + 1 - tileStartY) * tileSize - tileSize / 2);

  return [x1, y1, x2 - x1, y2 - y1];
}

function getIsInteractable(row: number, col: number, harsh: boolean = false): boolean {
  if (row === 0 && col === 0) return true;
  if (harsh) {
    const state = State.peekTileState(row, col);
    if (state === CONSTANTS.TILE_REVEALED) return false;
  }

  for (let i = 0; i < CONSTANTS.NEIGHBOR_OFFSETS.length; i++) {
    const [dr, dc] = CONSTANTS.NEIGHBOR_OFFSETS[i]!;
    const state = State.peekTileState(row + dr, col + dc);
    if (state === CONSTANTS.TILE_REVEALED) return true;
  }

  return false;
}

function getCanvasTile(
  clientX: number,
  clientY: number,
  camX: number,
  camY: number,
  camZoom: number,
): [row: number, col: number] {
  const rect = canvas.getBoundingClientRect();
  const canvasX = clientX - rect.left - canvas.width / 2;
  const canvasY = clientY - rect.top - canvas.height / 2;

  const scaledTileSize = CONSTANTS.TILE_SIZE * camZoom;

  const tileStartX = -camX / scaledTileSize;
  const tileStartY = -camY / scaledTileSize;

  const tileX = canvasX / scaledTileSize + tileStartX;
  const tileY = canvasY / scaledTileSize + tileStartY;

  return [Math.floor(tileY + 0.5), Math.floor(tileX + 0.5)];
}

function draw(): boolean {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let needsToRedraw = false;
  const now = performance.now();

  const [cx, cy] = State.viewPoint;
  const zoom = State.zoom;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 1 * zoom;
  ctx.font = `bold ${Math.floor(48 * zoom)}px ${CONSTANTS.FONT_FAMILY}`;

  const centreX = canvas.width / 2;
  const centreY = canvas.height / 2;
  const scaledTileSize = CONSTANTS.TILE_SIZE * zoom;

  const tileStartX = -cx / scaledTileSize;
  const tileStartY = -cy / scaledTileSize;

  const tileRadiusX = canvas.width / 2 / scaledTileSize;
  const tileRadiusY = canvas.height / 2 / scaledTileSize;

  const rowStart = Math.floor(tileStartY - tileRadiusY) - 1;
  const colStart = Math.floor(tileStartX - tileRadiusX) - 1;
  const rowEnd = Math.ceil(tileStartY + tileRadiusY) + 1;
  const colEnd = Math.ceil(tileStartX + tileRadiusX) + 1;

  const renderDetails = zoom > CONSTANTS.LOW_DETAIL_THRESHOLD;

  State.updateAnimations(now);

  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      if (!getIsInteractable(row, col)) continue;

      const [state, hasMine] = State.getTile(row, col);

      const [x, y, width, height] = getTileBox(row, col, centreX, centreY, tileStartX, tileStartY, scaledTileSize);

      let text = "";
      let txColour = CONSTANTS.COLOURS.TX;
      let bgColour = "";

      if (state === CONSTANTS.TILE_REVEALED) {
        if (hasMine) {
          text = "💥";
          bgColour = CONSTANTS.COLOURS.BG_MINE;
        } else {
          const mines = Utils.getNeighbouringTiles(row, col)[1];
          text = String(mines);
          txColour = CONSTANTS.COLOURS[`TX_${mines}` as keyof typeof CONSTANTS.COLOURS];
          bgColour = CONSTANTS.COLOURS[`BG_${mines}` as keyof typeof CONSTANTS.COLOURS];
        }
      } else if (state === CONSTANTS.TILE_FLAGGED) {
        text = "🚩";
        bgColour = CONSTANTS.COLOURS.BG_FLAG;
      }

      let scale = 1;
      const animationStart = State.getAnimation(row, col);

      if (animationStart) {
        needsToRedraw = true;
        const elapsed = now - animationStart;
        const progress = clamp(elapsed / CONSTANTS.ANIMATION_DURATION, 0, 1);
        scale = easeOutQuad(progress);
      }

      ctx.fillStyle = CONSTANTS.COLOURS.BG;
      ctx.fillRect(x, y, width, height);

      if (scale !== 1) {
        const tileCentreX = x + width / 2;
        const tileCentreY = y + height / 2;

        ctx.save();
        ctx.translate(tileCentreX, tileCentreY);
        ctx.scale(scale, scale);

        if (bgColour) {
          ctx.fillStyle = bgColour;
          ctx.fillRect(-width / 2, -height / 2, width, height);
        }

        if (renderDetails && text) {
          ctx.fillStyle = txColour;
          ctx.fillText(text, 0, 0);
        }
        ctx.restore();
      } else {
        if (bgColour) {
          ctx.fillStyle = bgColour;
          ctx.fillRect(x, y, width, height);
        }

        if (renderDetails && text) {
          ctx.fillStyle = txColour;
          ctx.fillText(text, x + width / 2, y + height / 2);
        }
      }

      if (renderDetails) {
        ctx.strokeStyle = CONSTANTS.COLOURS.BD;
        ctx.strokeRect(x, y, width, height);
      }
    }
  }

  ctx.restore();
  return needsToRedraw;
}

function tick(): void {
  const needsToRedraw = draw();

  if (needsToRedraw) {
    requestAnimationFrame(() => tick());
  } else {
    isDrawing = false;
  }
}

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let isDrawing = false;

export const Canvas = {
  setupCanvas(canvas_: HTMLCanvasElement): void {
    canvas = canvas_;
    ctx = canvas.getContext("2d")!;

    let pointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let dragStartX = 0;
    let dragStartY = 0;

    const activePointers: PointerEvent[] = [];
    let prevTouchDistance = -1;

    canvas.style.cursor = "default";
    canvas.style.touchAction = "none";

    const observer = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      Canvas.requestDraw();
    });
    observer.observe(canvas);

    const executeZoom = (zoomChange: number, clientX: number, clientY: number): void => {
      const zoom = State.zoom;
      const newZoom = clamp(zoom + zoomChange, CONSTANTS.MIN_ZOOM, CONSTANTS.MAX_ZOOM);

      if (newZoom === zoom) return;

      const [cx, cy] = State.viewPoint;
      const rect = canvas.getBoundingClientRect();
      const canvasX = clientX - rect.left - canvas.width / 2;
      const canvasY = clientY - rect.top - canvas.height / 2;

      State.viewPoint = [canvasX - ((canvasX - cx) * newZoom) / zoom, canvasY - ((canvasY - cy) * newZoom) / zoom];
      State.zoom = newZoom;

      const [row, col] = getCanvasTile(clientX, clientY, ...State.viewPoint, newZoom);
      const renderDetails = newZoom > CONSTANTS.LOW_DETAIL_THRESHOLD;
      canvas.style.cursor = getIsInteractable(row, col, true) && renderDetails ? "pointer" : "default";

      Canvas.requestDraw();
    };

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const zoomChange = -e.deltaY * CONSTANTS.ZOOM_SENSITIVITY;
        executeZoom(zoomChange, e.clientX, e.clientY);
      },
      { passive: false },
    );

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("pointerdown", (e) => {
      activePointers.push(e);

      if (activePointers.length === 2) {
        pointerDown = false;
        isDragging = false;
        const p1 = activePointers[0]!;
        const p2 = activePointers[1]!;
        prevTouchDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
        return;
      }

      if (activePointers.length === 1) {
        if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;

        const [camX, camY] = State.viewPoint;
        pointerDown = true;
        isDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        dragStartX = e.clientX - camX;
        dragStartY = e.clientY - camY;
      }
    });

    window.addEventListener("pointermove", (e) => {
      const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
      if (index !== -1) activePointers[index] = e;

      if (activePointers.length === 2) {
        const p1 = activePointers[0]!;
        const p2 = activePointers[1]!;

        const currentDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);

        if (prevTouchDistance > 0) {
          const deltaDistance = currentDistance - prevTouchDistance;
          const zoomChange = deltaDistance * CONSTANTS.ZOOM_SENSITIVITY * 5;

          const centerX = (p1.clientX + p2.clientX) / 2;
          const centerY = (p1.clientY + p2.clientY) / 2;

          executeZoom(zoomChange, centerX, centerY);
        }
        prevTouchDistance = currentDistance;
        return;
      }

      if (activePointers.length <= 1) {
        if (!pointerDown) {
          const zoom = State.zoom;
          const [row, col] = getCanvasTile(e.clientX, e.clientY, ...State.viewPoint, zoom);
          const renderDetails = zoom > CONSTANTS.LOW_DETAIL_THRESHOLD;
          canvas.style.cursor = getIsInteractable(row, col, true) && renderDetails ? "pointer" : "default";
        } else {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;

          if (!isDragging) {
            if (dx * dx + dy * dy >= CONSTANTS.DRAG_THRESHOLD * CONSTANTS.DRAG_THRESHOLD) {
              isDragging = true;
            }
          } else {
            State.viewPoint = [e.clientX - dragStartX, e.clientY - dragStartY];
            canvas.style.cursor = "grabbing";
            Canvas.requestDraw();
          }
        }
      }
    });

    const handlePointerUpOrCancel = (e: PointerEvent): void => {
      const index = activePointers.findIndex((p) => p.pointerId === e.pointerId);
      if (index !== -1) activePointers.splice(index, 1);

      if (activePointers.length < 2) {
        prevTouchDistance = -1;
      }

      if (!pointerDown || activePointers.length > 0) return;

      pointerDown = false;

      const zoom = State.zoom;
      const [row, col] = getCanvasTile(e.clientX, e.clientY, ...State.viewPoint, zoom);
      const isInteractable = getIsInteractable(row, col);

      if (isDragging) {
        isDragging = false;
        const renderDetails = zoom > CONSTANTS.LOW_DETAIL_THRESHOLD;
        canvas.style.cursor = getIsInteractable(row, col, true) && renderDetails ? "pointer" : "default";
      } else if (isInteractable && zoom > CONSTANTS.LOW_DETAIL_THRESHOLD) {
        if ((e.button === 2 || e.pointerType === "touch") && !(row === 0 && col === 0)) {
          Logic.flagTile(row, col).catch(console.error);
        } else if (e.button === 0 || (row === 0 && col === 0)) {
          Logic.revealTile(row, col).catch(console.error);
        }
      }
    };

    window.addEventListener("pointerup", handlePointerUpOrCancel);
    window.addEventListener("pointercancel", handlePointerUpOrCancel); // Critical for lost inputs
  },

  requestDraw(): void {
    if (!isDrawing) {
      isDrawing = true;
      requestAnimationFrame(() => tick());
    }
  },
};
