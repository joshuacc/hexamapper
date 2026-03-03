import type { AxialCoord, GridCalibration, MapBounds } from "./types";

export const SQRT3 = Math.sqrt(3);

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
  const size = calibration.hexSizePx;
  const x = size * 1.5 * coord.q;
  const y = size * SQRT3 * (coord.r + coord.q / 2);

  return {
    x: x + calibration.originPx.x + calibration.manualNudgePx.x,
    y: y + calibration.originPx.y + calibration.manualNudgePx.y,
  };
}

export function pixelToAxial(
  pixel: { x: number; y: number },
  calibration: GridCalibration,
): AxialCoord {
  const size = calibration.hexSizePx;
  const localX = pixel.x - calibration.originPx.x - calibration.manualNudgePx.x;
  const localY = pixel.y - calibration.originPx.y - calibration.manualNudgePx.y;

  const q = (2 / 3) * localX / size;
  const r = ((-1 / 3) * localX + (SQRT3 / 3) * localY) / size;

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
