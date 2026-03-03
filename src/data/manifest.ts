import { ASSET_MANIFEST } from "./assetManifest.generated";
import type { AssetManifestItem, AssetLayerHint, EditorLayer } from "../domain/types";

export const manifestById = new Map<string, AssetManifestItem>(
  ASSET_MANIFEST.map((item) => [item.id, item]),
);

export function searchManifest(query: string, layer: EditorLayer | "all"): AssetManifestItem[] {
  const normalized = query.trim().toLowerCase();
  const filterLayer = toAssetLayer(layer);

  return ASSET_MANIFEST.filter((item) => {
    const layerMatches = filterLayer ? item.inferredLayer === filterLayer : true;
    if (!layerMatches) {
      return false;
    }

    if (!normalized) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(normalized) ||
      item.category.toLowerCase().includes(normalized) ||
      item.tags.some((tag) => tag.includes(normalized))
    );
  });
}

function toAssetLayer(layer: EditorLayer | "all"): AssetLayerHint | null {
  if (layer === "all" || layer === "fog") {
    return null;
  }

  return layer;
}

export function groupedCategories(items: AssetManifestItem[]): string[] {
  return [...new Set(items.map((item) => item.category))].sort((a, b) => a.localeCompare(b));
}
