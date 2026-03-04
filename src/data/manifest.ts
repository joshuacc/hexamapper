import { ASSET_MANIFEST } from "./assetManifest.generated";
import type { AssetManifestItem, AssetLayerHint, EditorLayer } from "../domain/types";

export const manifestById = new Map<string, AssetManifestItem>(
  ASSET_MANIFEST.map((item) => [item.id, item]),
);

const THEME_TAGS = new Set([
  "lush",
  "snow",
  "snowy",
  "rocky",
  "desert",
  "damp",
  "badlands",
  "cursed",
  "dry",
  "ocean",
  "swamp",
  "farmland",
  "blank",
]);

const DIRECTION_TOKEN_REGEX = /^(n|s|e|w|ne|nw|se|sw)$/i;

export type TileHierarchy = {
  theme: string;
  family: string;
  type: string;
  detail: string;
};

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

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDisplayLabel(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[nswe]{1,2}$/i.test(part)) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function stripDirectionalSuffix(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return value;
  }

  const lastWord = words[words.length - 1];
  if (DIRECTION_TOKEN_REGEX.test(lastWord)) {
    words.pop();
  }

  return words.join(" ").trim();
}

function parseParentheticalValues(name: string): string[] {
  return [...name.matchAll(/\(([^)]+)\)/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((value) => value.length > 0);
}

function parseMainSegments(name: string): string[] {
  const stripped = name
    .replace(/^Hex\s*-\s*/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return stripped
    .split(/\s*-\s*/)
    .flatMap((part) => part.split(","))
    .map((part) => stripDirectionalSuffix(part.trim()))
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0);
}

function pickTheme(item: AssetManifestItem, parentheticalValues: string[]): string {
  for (const value of parentheticalValues) {
    if (THEME_TAGS.has(normalizeToken(value))) {
      return toDisplayLabel(value);
    }
  }

  for (const tag of item.tags) {
    if (THEME_TAGS.has(normalizeToken(tag))) {
      return toDisplayLabel(tag);
    }
  }

  return "Neutral";
}

function pickDetail(
  item: AssetManifestItem,
  segments: string[],
  parentheticalValues: string[],
): string {
  if (segments[2]) {
    return toDisplayLabel(segments[2]);
  }

  const descriptor = parentheticalValues.find((value) => !THEME_TAGS.has(normalizeToken(value)));
  if (descriptor) {
    return toDisplayLabel(descriptor);
  }

  const variantMatch = item.name.match(/\b(\d+|N|S|E|W|NE|NW|SE|SW)\b$/i);
  if (variantMatch?.[1]) {
    return variantMatch[1].toUpperCase();
  }

  return "General";
}

export function deriveTileHierarchy(item: AssetManifestItem): TileHierarchy {
  const parentheticalValues = parseParentheticalValues(item.name);
  const segments = parseMainSegments(item.name);

  const familyRaw = segments[0] || item.category.split(",")[0]?.trim() || "Misc";
  const typeRaw = segments[1] || "General";

  return {
    theme: pickTheme(item, parentheticalValues),
    family: toDisplayLabel(familyRaw),
    type: toDisplayLabel(typeRaw),
    detail: pickDetail(item, segments, parentheticalValues),
  };
}
