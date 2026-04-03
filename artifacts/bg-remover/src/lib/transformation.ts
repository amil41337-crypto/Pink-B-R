export class Transform {
  private _brightness: number = 1;
  private _contrast: number = 1;
  private _saturation: number = 1;
  private _blur: number = 0;
  private _hue: number = 0;

  brightness(value: number): this {
    this._brightness = Math.max(0, value);
    return this;
  }

  contrast(value: number): this {
    this._contrast = Math.max(0, value);
    return this;
  }

  saturation(value: number): this {
    this._saturation = Math.max(0, value);
    return this;
  }

  blur(radius: number): this {
    this._blur = Math.max(0, radius);
    return this;
  }

  hue(degrees: number): this {
    this._hue = degrees % 360;
    return this;
  }

  toCSSFilter(): string {
    const parts: string[] = [];
    if (this._brightness !== 1) parts.push(`brightness(${this._brightness})`);
    if (this._contrast !== 1) parts.push(`contrast(${this._contrast})`);
    if (this._saturation !== 1) parts.push(`saturate(${this._saturation})`);
    if (this._blur > 0) parts.push(`blur(${this._blur}px)`);
    if (this._hue !== 0) parts.push(`hue-rotate(${this._hue}deg)`);
    return parts.join(" ") || "none";
  }

  applyToCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.filter = this.toCSSFilter();
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tmpCtx = tmp.getContext("2d");
    if (!tmpCtx) return;
    tmpCtx.drawImage(canvas, 0, 0);
    ctx.filter = this.toCSSFilter();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0);
    ctx.filter = "none";
  }

  applyToImageData(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const { width, height } = imageData;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;
      const a = data[i + 3];

      r = Math.min(1, r * this._brightness);
      g = Math.min(1, g * this._brightness);
      b = Math.min(1, b * this._brightness);

      r = Math.min(1, Math.max(0, (r - 0.5) * this._contrast + 0.5));
      g = Math.min(1, Math.max(0, (g - 0.5) * this._contrast + 0.5));
      b = Math.min(1, Math.max(0, (b - 0.5) * this._contrast + 0.5));

      if (this._saturation !== 1) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = Math.min(1, Math.max(0, gray + (r - gray) * this._saturation));
        g = Math.min(1, Math.max(0, gray + (g - gray) * this._saturation));
        b = Math.min(1, Math.max(0, gray + (b - gray) * this._saturation));
      }

      data[i] = Math.round(r * 255);
      data[i + 1] = Math.round(g * 255);
      data[i + 2] = Math.round(b * 255);
      data[i + 3] = a;
    }

    return new ImageData(data, width, height);
  }
}

export function removeBackground(imageData: ImageData, tolerance = 60): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const { width, height } = imageData;

  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)], [Math.floor(width / 2), height - 1],
    [Math.floor(width / 4), 0], [Math.floor(3 * width / 4), 0],
  ];

  const bgSamples: number[][] = [];
  for (const [cx, cy] of corners) {
    const idx = (cy * width + cx) * 4;
    bgSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
  }

  const avgBg = bgSamples.reduce(
    (acc, c) => [acc[0] + c[0] / bgSamples.length, acc[1] + c[1] / bgSamples.length, acc[2] + c[2] / bgSamples.length],
    [0, 0, 0]
  );

  const floodFillMask = new Uint8Array(width * height);
  const queue: number[] = [];

  const inBounds = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height;
  const pixelDist = (idx: number) => {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    return Math.sqrt(
      Math.pow(r - avgBg[0], 2) + Math.pow(g - avgBg[1], 2) + Math.pow(b - avgBg[2], 2)
    );
  };

  const seeds = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)], [Math.floor(width / 2), height - 1],
  ];

  for (const [sx, sy] of seeds) {
    const seedIdx = sy * width + sx;
    if (!floodFillMask[seedIdx] && pixelDist(seedIdx * 4) < tolerance) {
      floodFillMask[seedIdx] = 1;
      queue.push(seedIdx);
    }
  }

  const dirs = [-1, 1, -width, width];
  while (queue.length > 0) {
    const curr = queue.pop()!;
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    for (const d of dirs) {
      const nx = cx + (d === -1 ? -1 : d === 1 ? 1 : 0);
      const ny = cy + (d === -width ? -1 : d === width ? 1 : 0);
      if (!inBounds(nx, ny)) continue;
      const nIdx = ny * width + nx;
      if (floodFillMask[nIdx]) continue;
      if (pixelDist(nIdx * 4) < tolerance) {
        floodFillMask[nIdx] = 1;
        queue.push(nIdx);
      }
    }
  }

  for (let i = 0; i < width * height; i++) {
    if (floodFillMask[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  return new ImageData(data, width, height);
}

export function featherEdges(imageData: ImageData, radius = 2): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const { width, height } = imageData;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] === 0) continue;

      let minDist = radius + 1;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = (ny * width + nx) * 4;
          if (data[nIdx + 3] === 0) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) minDist = dist;
          }
        }
      }

      if (minDist <= radius) {
        data[idx + 3] = Math.round((minDist / radius) * 255);
      }
    }
  }

  return new ImageData(data, width, height);
}
