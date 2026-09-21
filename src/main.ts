import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#app")!;
if (!canvas) throw new Error("Could not get #app element.");
const ctx = canvas.getContext("2d", { alpha: false })!;
if (!ctx) throw new Error("Browser does not support canvas.");

let canvasWidth = 0;
let canvasHeight = 0;

let dirty = true;

function draw(): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}

function tick(): void {
  if (dirty) {
    draw();
    dirty = false;
  }

  requestAnimationFrame(tick);
}

const observer = new ResizeObserver((entries) => {
  const entry = entries[0]!;
  const { width, height } = entry.contentRect;

  canvas.width = width;
  canvas.height = height;
  canvasWidth = width;
  canvasHeight = height;

  dirty = true;
});
observer.observe(canvas);

requestAnimationFrame(tick);
