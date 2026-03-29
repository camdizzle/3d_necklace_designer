/**
 * Image processing utilities for converting raster images to
 * pendant silhouettes (contour tracing) and relief heightmaps.
 * Pure Canvas 2D — no external dependencies.
 */

/**
 * Load an image File into an HTMLImageElement.
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Draw image to a canvas at a target size, return ImageData.
 */
function imageToCanvas(img, maxSize) {
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return { ctx, width: w, height: h, data: ctx.getImageData(0, 0, w, h) };
}

/**
 * Convert ImageData to a binary (0/1) grid based on threshold.
 * Pixels with alpha < 128 are treated as background.
 */
function toBinaryGrid(imageData, width, height, threshold) {
  const pixels = imageData.data;
  const grid = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      grid[y * width + x] = (a >= 128 && gray < threshold) ? 1 : 0;
    }
  }
  return grid;
}

/**
 * Moore neighborhood contour tracing.
 * Finds the boundary of the largest foreground region.
 */
function traceContour(grid, width, height) {
  // Find start pixel (topmost-leftmost foreground pixel)
  let startX = -1, startY = -1;
  outer:
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y * width + x] === 1) {
        startX = x;
        startY = y;
        break outer;
      }
    }
  }

  if (startX === -1) return [];

  // Moore neighborhood: 8 directions clockwise from left
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];

  const contour = [];
  let cx = startX, cy = startY;
  let dir = 0; // start looking left

  const maxSteps = width * height * 2;
  let steps = 0;

  do {
    contour.push([cx, cy]);

    // Search clockwise from (dir + 5) % 8 (backtrack direction + 1)
    let searchDir = (dir + 5) % 8;
    let found = false;

    for (let i = 0; i < 8; i++) {
      const nd = (searchDir + i) % 8;
      const nx = cx + dx[nd];
      const ny = cy + dy[nd];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny * width + nx] === 1) {
        dir = nd;
        cx = nx;
        cy = ny;
        found = true;
        break;
      }
    }

    if (!found) break;
    steps++;
  } while ((cx !== startX || cy !== startY) && steps < maxSteps);

  return contour;
}

/**
 * Ramer-Douglas-Peucker line simplification.
 */
function simplifyPoints(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPoints(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

function perpendicularDist(point, lineStart, lineEnd) {
  const [px, py] = point;
  const [ax, ay] = lineStart;
  const [bx, by] = lineEnd;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / Math.sqrt(lenSq);
}

/**
 * Trace image silhouette and return normalized shape points.
 * @param {File} imageFile
 * @param {{ threshold?: number }} options
 * @returns {Promise<Array<[number, number]>>} Points normalized to [-0.5, 0.5]
 */
export async function traceImageSilhouette(imageFile, options = {}) {
  const threshold = options.threshold ?? 128;
  const img = await loadImage(imageFile);
  const { data, width, height } = imageToCanvas(img, 256);
  const grid = toBinaryGrid(data, width, height, threshold);
  let contour = traceContour(grid, width, height);

  if (contour.length < 3) return [];

  // Simplify
  contour = simplifyPoints(contour, 1.5);

  if (contour.length < 3) return [];

  // Normalize to [-0.5, 0.5]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of contour) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  return contour.map(([x, y]) => [
    (x - minX) / rangeX - 0.5,
    -((y - minY) / rangeY - 0.5) // flip Y (canvas Y is top-down)
  ]);
}

/**
 * Create heightmap data from an image for relief displacement.
 * @param {File} imageFile
 * @param {{ resolution?: number, invert?: boolean }} options
 * @returns {Promise<{ width: number, height: number, data: Float32Array }>}
 */
export async function createHeightmapData(imageFile, options = {}) {
  const resolution = options.resolution ?? 64;
  const invert = options.invert ?? false;

  const img = await loadImage(imageFile);

  // Draw at exact resolution for consistent grid
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, resolution, resolution);
  const imageData = ctx.getImageData(0, 0, resolution, resolution);
  const pixels = imageData.data;

  const data = new Float32Array(resolution * resolution);

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      const i = (y * resolution + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
      let brightness = (r + g + b) / (3 * 255);
      // Transparent pixels = no displacement
      if (a < 128) brightness = 0;
      if (invert) brightness = 1 - brightness;
      data[y * resolution + x] = brightness;
    }
  }

  // Simple 3x3 Gaussian blur pass to smooth
  const blurred = new Float32Array(resolution * resolution);
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kernelSum = 16;

  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      let sum = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const sx = Math.min(resolution - 1, Math.max(0, x + kx));
          const sy = Math.min(resolution - 1, Math.max(0, y + ky));
          sum += data[sy * resolution + sx] * kernel[ki];
          ki++;
        }
      }
      blurred[y * resolution + x] = sum / kernelSum;
    }
  }

  return { width: resolution, height: resolution, data: blurred };
}
