import { Canvas } from "./canvas";
import { CONSTANTS } from "./constants";
import { Logic } from "./logic";
import { State } from "./state";
import { Store } from "./store";
import { Utils } from "./utils";

declare global {
  interface Window {
    IMS: typeof import(".").IMS;
    IMS_DEV: typeof import(".").IMS_DEV;
  }
}

export const IMS = {
  async init(): Promise<void> {
    const canvas = document.getElementById(CONSTANTS.CANVAS_ID);

    if (!canvas) {
      throw new Error("Element not found");
    }
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Element not a canvas");
    }

    await Store.loadGame();

    Canvas.setupCanvas(canvas);
    Canvas.requestDraw();

    window.addEventListener("beforeunload", () => {
      Store.saveGame().catch(console.error);
    });
  },

  restart(): void {
    State.clearTiles();
    State.viewPoint = [0, 0];
    State.zoom = 1;
    State.seed = Utils.getRandomSeed();
    State.density = CONSTANTS.DEFAULT_DENSITY;

    Canvas.requestDraw();
  },
};

export const IMS_DEV = { CONSTANTS, Utils, State, Logic, Canvas, Store };

window.IMS = IMS;
window.IMS_DEV = IMS_DEV;
