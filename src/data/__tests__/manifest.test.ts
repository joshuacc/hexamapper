import { describe, expect, it } from "vitest";
import { deriveTileHierarchy } from "../manifest";
import type { AssetManifestItem } from "../../domain/types";

function buildItem(name: string, category: string, tags: string[]): AssetManifestItem {
  return {
    id: `base:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    path: "/test.png",
    pack: "base",
    framePx: { w: 224, h: 194 },
    category,
    tags,
    inferredLayer: "base",
  };
}

describe("deriveTileHierarchy", () => {
  it("extracts biome and terrain family/type from forest tiles", () => {
    const hierarchy = deriveTileHierarchy(
      buildItem("Hex - Forest, mixed (lush)", "Forest, mixed", ["base", "forest", "mixed", "lush"]),
    );

    expect(hierarchy).toEqual({
      theme: "Lush",
      family: "Forest",
      type: "Mixed",
      detail: "General",
    });
  });

  it("captures volcano variants from numbered mountain names", () => {
    const hierarchy = deriveTileHierarchy(
      buildItem(
        "Hex - Mountain, Volcano (snowy) 2",
        "Mountain, Volcano",
        ["base", "mountain", "volcano", "snowy"],
      ),
    );

    expect(hierarchy).toEqual({
      theme: "Snowy",
      family: "Mountain",
      type: "Volcano",
      detail: "2",
    });
  });

  it("uses non-theme descriptors as detail", () => {
    const hierarchy = deriveTileHierarchy(
      buildItem("Hex - Coast - Beach (big) NW", "Coast", ["base", "coast", "beach", "big"]),
    );

    expect(hierarchy).toEqual({
      theme: "Neutral",
      family: "Coast",
      type: "Beach",
      detail: "Big",
    });
  });
});
