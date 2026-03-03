export const TERRAIN_TRIM_REFERENCE_PX = 8;
export const TERRAIN_REFERENCE_HEIGHT_PX = 194;
export const TERRAIN_REFERENCE_WIDTH_PX = 224;
export const TERRAIN_SIDE_EXTRA_TRIM_REFERENCE_PX = 2;
export const TERRAIN_SIDE_BAND_REFERENCE_PX = 18;

const OPAQUE_ALPHA_THRESHOLD = 8;

export function createTrimmedTerrainCanvas(
  image: HTMLImageElement,
  trimReferencePx = TERRAIN_TRIM_REFERENCE_PX,
): HTMLCanvasElement | null {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const trimPx = Math.max(
    1,
    Math.round((height * trimReferencePx) / TERRAIN_REFERENCE_HEIGHT_PX),
  );
  const sideExtraTrimPx = Math.max(
    0,
    Math.round((height * TERRAIN_SIDE_EXTRA_TRIM_REFERENCE_PX) / TERRAIN_REFERENCE_HEIGHT_PX),
  );
  const sideBandPx = Math.max(
    1,
    Math.round((width * TERRAIN_SIDE_BAND_REFERENCE_PX) / TERRAIN_REFERENCE_WIDTH_PX),
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const bottomByX = new Int32Array(width);
  bottomByX.fill(-1);

  // Build a bottom silhouette profile: for each column, track the lowest visible pixel.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const alpha = pixels[idx + 3];
      if (alpha > OPAQUE_ALPHA_THRESHOLD) {
        bottomByX[x] = y;
      }
    }
  }

  let hasOpaquePixel = false;
  let minOpaqueX = width;
  let maxOpaqueX = -1;
  for (let x = 0; x < width; x += 1) {
    if (bottomByX[x] >= 0) {
      hasOpaquePixel = true;
      minOpaqueX = Math.min(minOpaqueX, x);
      maxOpaqueX = Math.max(maxOpaqueX, x);
    }
  }
  if (!hasOpaquePixel) {
    return null;
  }

  // Trim mostly from the bottom, with extra removal near left/right corners.
  // This keeps center rows touching while cleaning up corner skirt pixels.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const bottomY = bottomByX[x];
      if (bottomY < 0) {
        continue;
      }
      const distToEdge = Math.min(x - minOpaqueX, maxOpaqueX - x);
      const sideWeight = distToEdge >= sideBandPx ? 0 : (sideBandPx - distToEdge) / sideBandPx;
      const columnTrimPx = trimPx + Math.round(sideExtraTrimPx * sideWeight);
      const idx = (y * width + x) * 4;
      const alpha = pixels[idx + 3];
      if (alpha <= OPAQUE_ALPHA_THRESHOLD) {
        continue;
      }
      if (y > bottomY - columnTrimPx) {
        pixels[idx + 3] = 0;
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}
