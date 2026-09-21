import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#app")!;
if (!canvas) throw new Error("Could not get #app element.");
const ctx = canvas.getContext("2d", { alpha: false })!;
if (!ctx) throw new Error("Browser does not support canvas.");

const observer = new ResizeObserver((entries) => {
  const entry = entries[0]!;
  const { width, height } = entry.contentRect;

  canvas.width = width;
  canvas.height = height;
});
observer.observe(canvas);
