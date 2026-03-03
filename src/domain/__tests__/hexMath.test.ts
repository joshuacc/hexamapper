import { describe, expect, it } from "vitest";
import {
  axialDistance,
  axialKey,
  axialLine,
  axialToPixel,
  isWithinBounds,
  iterateBounds,
  neighbors,
  parseAxialKey,
  pixelToAxial,
} from "../hexMath";
import { DEFAULT_CALIBRATION } from "../types";

describe("hexMath", () => {
  it("round-trips axial key parsing", () => {
    const key = axialKey({ q: 7, r: -3 });
    expect(key).toBe("7,-3");
    expect(parseAxialKey(key)).toEqual({ q: 7, r: -3 });
  });

  it("round-trips axial-to-pixel conversion", () => {
    const coord = { q: 12, r: 9 };
    const pixel = axialToPixel(coord, DEFAULT_CALIBRATION);
    expect(pixelToAxial(pixel, DEFAULT_CALIBRATION)).toEqual(coord);
  });

  it("computes neighbors and distance", () => {
    const center = { q: 2, r: 4 };
    const ring = neighbors(center);
    expect(ring).toHaveLength(6);
    for (const coord of ring) {
      expect(axialDistance(center, coord)).toBe(1);
    }
  });

  it("draws stable line paths", () => {
    const points = axialLine({ q: 0, r: 0 }, { q: 4, r: -2 });
    expect(points[0]).toEqual({ q: 0, r: 0 });
    expect(points[points.length - 1]).toEqual({ q: 4, r: -2 });
    expect(points.length).toBeGreaterThan(1);
  });

  it("iterates rectangular bounds using offset rows", () => {
    const bounds = { minQ: 0, maxQ: 2, minR: 0, maxR: 2 };
    const coords = iterateBounds(bounds);
    expect(coords).toHaveLength(9);
    expect(coords).toContainEqual({ q: 2, r: -1 });
    expect(isWithinBounds({ q: 2, r: -1 }, bounds)).toBe(true);
    expect(isWithinBounds({ q: 2, r: 2 }, bounds)).toBe(false);
  });
});
