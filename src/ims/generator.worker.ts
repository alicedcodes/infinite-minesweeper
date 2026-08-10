function mulberry32(a: number): number {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

self.onmessage = (e: MessageEvent<{ id: number; row: number; col: number; seed: number; density: number }>): void => {
  const { id, row, col, seed, density } = e.data;

  const spatialCoordinateHash = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
  const coordinateInt = Math.floor(spatialCoordinateHash) | 0;
  const hasMine = mulberry32(coordinateInt ^ seed) < density;

  self.postMessage({ id, hasMine });
};
