import { axialToPixel, boundsPixelEnvelope, parseAxialKey } from "../domain/hexMath";
import type { AssetManifestItem, HexProjectV1 } from "../domain/types";

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      }),
    );
  }
  return imageCache.get(src)!;
}

function zIndexFor(y: number, x: number, layerPriority: number): number {
  return Math.floor(y * 1000) + Math.floor(layerPriority * 10) + Math.floor(x % 997);
}

function hexPoints(centerX: number, centerY: number, size: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let corner = 0; corner < 6; corner += 1) {
    const angle = (Math.PI / 180) * (60 * corner);
    points.push([centerX + size * Math.cos(angle), centerY + size * Math.sin(angle)]);
  }
  return points;
}

type DrawSprite = {
  src: string;
  x: number;
  y: number;
  z: number;
};

export async function renderProjectToBlob(
  project: HexProjectV1,
  assetsById: Map<string, AssetManifestItem>,
): Promise<Blob> {
  const calibration = project.calibration;

  const envelope = boundsPixelEnvelope(project.metadata.maxBounds, calibration);
  let minX = envelope.minX;
  let minY = envelope.minY;
  let maxX = envelope.maxX;
  let maxY = envelope.maxY;

  const sprites: DrawSprite[] = [];

  for (const [key, cell] of Object.entries(project.cells)) {
    const coord = parseAxialKey(key);
    const center = axialToPixel(coord, calibration);

    function pushTile(tileId: string, layerPriority: number): void {
      const item = assetsById.get(tileId);
      if (!item) {
        return;
      }

      const topLeftX = center.x - calibration.spriteAnchorPx.x;
      const topLeftY = center.y - calibration.spriteAnchorPx.y;
      const bottomRightX = topLeftX + calibration.tileFramePx.w;
      const bottomRightY = topLeftY + calibration.tileFramePx.h;

      minX = Math.min(minX, topLeftX);
      minY = Math.min(minY, topLeftY);
      maxX = Math.max(maxX, bottomRightX);
      maxY = Math.max(maxY, bottomRightY);

      sprites.push({
        src: item.path,
        x: topLeftX,
        y: topLeftY,
        z: zIndexFor(center.y, center.x, layerPriority),
      });
    }

    if (cell.baseTileId) {
      pushTile(cell.baseTileId, 0);
    }

    cell.overlayTileIds.forEach((tileId, idx) => pushTile(tileId, 1 + idx * 0.01));
    cell.markerTileIds.forEach((tileId, idx) => pushTile(tileId, 2 + idx * 0.01));
  }

  const width = Math.max(1, Math.ceil(maxX - minX));
  const height = Math.max(1, Math.ceil(maxY - minY));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize PNG export context.");
  }

  sprites.sort((a, b) => a.z - b.z);

  for (const sprite of sprites) {
    const image = await loadImage(sprite.src);
    ctx.drawImage(image, sprite.x - minX, sprite.y - minY);
  }

  for (const [key, cell] of Object.entries(project.cells)) {
    const coord = parseAxialKey(key);
    const center = axialToPixel(coord, calibration);

    if (cell.fog !== "none") {
      ctx.fillStyle = cell.fog === "full" ? "rgba(24,16,12,0.75)" : "rgba(24,16,12,0.42)";
      const points = hexPoints(center.x - minX, center.y - minY, calibration.hexSizePx);
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let idx = 1; idx < points.length; idx += 1) {
        ctx.lineTo(points[idx][0], points[idx][1]);
      }
      ctx.closePath();
      ctx.fill();
    }

    if (cell.label?.text) {
      const labelX = center.x - minX + cell.label.offsetPx.x;
      const labelY = center.y - minY + cell.label.offsetPx.y;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = cell.label.style === "title" ? 4 : 3;
      ctx.strokeStyle = "rgba(20, 16, 12, 0.95)";
      ctx.fillStyle = cell.label.color;
      ctx.font =
        cell.label.style === "title"
          ? "700 20px 'Cinzel', serif"
          : "500 14px 'Alegreya', serif";
      ctx.strokeText(cell.label.text, labelX, labelY);
      ctx.fillText(cell.label.text, labelX, labelY);
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("PNG export failed."));
        return;
      }
      resolve(result);
    }, "image/png");
  });

  return blob;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
