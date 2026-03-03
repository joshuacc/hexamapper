import { describe, expect, it } from "vitest";
import { createProject, parseProject } from "../projectSchema";

describe("projectSchema", () => {
  it("creates a valid project with defaults", () => {
    const project = createProject("Test Map");
    expect(project.version).toBe(1);
    expect(project.metadata.name).toBe("Test Map");
    expect(project.metadata.tileSet).toBe("vtt-72");
    expect(project.cells).toEqual({});
  });

  it("normalizes loaded project values", () => {
    const parsed = parseProject({
      version: 1,
      metadata: {
        name: "Loaded",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tileSet: "vtt-72",
        coordinateSystem: "axial",
        maxBounds: { minQ: 0, maxQ: 8, minR: 0, maxR: 8 },
      },
      calibration: {
        orientation: "flat-top",
        hexSizePx: 59,
        originPx: { x: 320, y: 220 },
        tileFramePx: { w: 224, h: 194 },
        spriteAnchorPx: { x: 112, y: 102 },
        manualNudgePx: { x: 0, y: 0 },
      },
      cells: {
        "0,0": {
          baseTileId: "base:hex-base-lush",
          overlayTileIds: ["overlay:river", "overlay:river"],
          markerTileIds: [],
          fog: "none",
        },
      },
    });

    expect(parsed.cells["0,0"].overlayTileIds).toEqual(["overlay:river"]);
  });
});
