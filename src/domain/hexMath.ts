import type { AxialCoord, GridCalibration, MapBounds } from "./types";

export const SQRT3 = Math.sqrt(3);
const HEX_VERTICAL_SHRINK_REFERENCE_PX = 6;
const HEX_HORIZONTAL_SHRINK_REFERENCE_PX = 2;
const HEX_FACE_VERTICAL_INSET_REFERENCE_PX = 8;
const TERRAIN_REFERENCE_HEIGHT_PX = 194;
const TERRAIN_REFERENCE_WIDTH_PX = 224;

export function axialKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

export function parseAxialKey(key: string): AxialCoord {
  const [qPart, rPart] = key.split(",");
  return { q: Number(qPart), r: Number(rPart) };
}

export function offsetRowForAxial(coord: AxialCoord): number {
  return coord.r + Math.floor((coord.q - (coord.q & 1)) / 2);
}

export function hexVerticalShrinkPx(calibration: GridCalibration): number {
  return (calibration.tileFramePx.h * HEX_VERTICAL_SHRINK_REFERENCE_PX) / TERRAIN_REFERENCE_HEIGHT_PX;
}

export function hexHorizontalShrinkPx(calibration: GridCalibration): number {
  return (calibration.tileFramePx.w * HEX_HORIZONTAL_SHRINK_REFERENCE_PX) / TERRAIN_REFERENCE_WIDTH_PX;
}

export function hexColumnStepPx(calibration: GridCalibration): number {
  return Math.max(1, calibration.hexSizePx * 1.5 - hexHorizontalShrinkPx(calibration));
}

export function hexRowHeightPx(calibration: GridCalibration): number {
  return Math.max(1, calibration.hexSizePx * SQRT3 - hexVerticalShrinkPx(calibration));
}

export function hexHorizontalRadiusPx(calibration: GridCalibration): number {
  return (hexColumnStepPx(calibration) * 2) / 3;
}

export function hexVerticalRadiusPx(calibration: GridCalibration): number {
  return Math.max(
    1,
    (calibration.hexSizePx * SQRT3) / 2 - hexFaceVerticalInsetPx(calibration) / 2,
  );
}

export function hexFaceVerticalInsetPx(calibration: GridCalibration): number {
  return (
    (calibration.tileFramePx.h * HEX_FACE_VERTICAL_INSET_REFERENCE_PX) / TERRAIN_REFERENCE_HEIGHT_PX
  );
}

export function hexOverlayCenterOffsetPx(calibration: GridCalibration): { x: number; y: number } {
  return {
    x: 0,
    y: -hexFaceVerticalInsetPx(calibration) / 2,
  };
}

export function isWithinBounds(coord: AxialCoord, bounds: MapBounds): boolean {
  const offsetRow = offsetRowForAxial(coord);
  return (
    coord.q >= bounds.minQ &&
    coord.q <= bounds.maxQ &&
    offsetRow >= bounds.minR &&
    offsetRow <= bounds.maxR
  );
}

export function axialToPixel(coord: AxialCoord, calibration: GridCalibration): { x: number; y: number } {
  const columnStep = hexColumnStepPx(calibration);
  const rowHeight = hexRowHeightPx(calibration);
  const x = columnStep * coord.q;
  const y = rowHeight * (coord.r + coord.q / 2);

  return {
    x: x + calibration.originPx.x + calibration.manualNudgePx.x,
    y: y + calibration.originPx.y + calibration.manualNudgePx.y,
  };
}

export function pixelToAxial(
  pixel: { x: number; y: number },
  calibration: GridCalibration,
): AxialCoord {
  const columnStep = hexColumnStepPx(calibration);
  const rowHeight = hexRowHeightPx(calibration);
  const localX = pixel.x - calibration.originPx.x - calibration.manualNudgePx.x;
  const localY = pixel.y - calibration.originPx.y - calibration.manualNudgePx.y;

  const q = localX / columnStep;
  const r = localY / rowHeight - q / 2;

  return roundAxial({ q, r });
}

export function axialDistance(a: AxialCoord, b: AxialCoord): number {
  const aq = a.q;
  const ar = a.r;
  const as = -aq - ar;

  const bq = b.q;
  const br = b.r;
  const bs = -bq - br;

  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs));
}

export function roundAxial(coord: { q: number; r: number }): AxialCoord {
  const x = coord.q;
  const z = coord.r;
  const y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function axialLine(from: AxialCoord, to: AxialCoord): AxialCoord[] {
  const distance = axialDistance(from, to);
  if (distance === 0) {
    return [from];
  }

  const output: AxialCoord[] = [];
  for (let step = 0; step <= distance; step += 1) {
    const t = step / distance;
    output.push(
      roundAxial({
        q: lerp(from.q, to.q, t),
        r: lerp(from.r, to.r, t),
      }),
    );
  }

  return dedupeAxial(output);
}

export function neighbors(coord: AxialCoord): AxialCoord[] {
  return AXIAL_DIRECTIONS.map(([dq, dr]) => ({ q: coord.q + dq, r: coord.r + dr }));
}

export const AXIAL_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
] as const;

export function dedupeAxial(coords: AxialCoord[]): AxialCoord[] {
  const seen = new Set<string>();
  const output: AxialCoord[] = [];
  for (const coord of coords) {
    const key = axialKey(coord);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(coord);
    }
  }
  return output;
}

export function iterateBounds(bounds: MapBounds): AxialCoord[] {
  const out: AxialCoord[] = [];
  for (let q = bounds.minQ; q <= bounds.maxQ; q += 1) {
    const rowOffset = Math.floor((q - (q & 1)) / 2);
    for (let row = bounds.minR; row <= bounds.maxR; row += 1) {
      out.push({ q, r: row - rowOffset });
    }
  }
  return out;
}

export function boundsPixelEnvelope(
  bounds: MapBounds,
  calibration: GridCalibration,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const coords = iterateBounds(bounds);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const coord of coords) {
    const point = axialToPixel(coord, calibration);
    minX = Math.min(minX, point.x - calibration.spriteAnchorPx.x);
    maxX = Math.max(maxX, point.x + (calibration.tileFramePx.w - calibration.spriteAnchorPx.x));
    minY = Math.min(minY, point.y - calibration.spriteAnchorPx.y);
    maxY = Math.max(maxY, point.y + (calibration.tileFramePx.h - calibration.spriteAnchorPx.y));
  }

  return { minX, minY, maxX, maxY };
}
