export type AxialCoord = {
  q: number;
  r: number;
};

export type EditorLayer = "base" | "overlay" | "marker" | "fog";

export type FogLevel = "none" | "light" | "full";

export type LabelStyle = "small" | "title";

export type HexLabel = {
  text: string;
  style: LabelStyle;
  color: string;
  offsetPx: { x: number; y: number };
};

export type HexLayerSet = {
  baseTileId: string | null;
  overlayTileIds: string[];
  markerTileIds: string[];
  fog: FogLevel;
  label?: HexLabel;
  notes?: string;
};

export type GridCalibration = {
  orientation: "flat-top";
  hexSizePx: number;
  originPx: { x: number; y: number };
  tileFramePx: { w: number; h: number };
  spriteAnchorPx: { x: number; y: number };
  manualNudgePx: { x: number; y: number };
};

export type MapBounds = {
  minQ: number;
  maxQ: number;
  minR: number;
  maxR: number;
};

export type HexProjectMetadata = {
  name: string;
  createdAt: string;
  updatedAt: string;
  tileSet: "vtt-72";
  coordinateSystem: "axial";
  maxBounds: MapBounds;
};

export type HexProjectV1 = {
  version: 1;
  metadata: HexProjectMetadata;
  calibration: GridCalibration;
  cells: Record<string, HexLayerSet>;
};

export type AssetLayerHint = "base" | "overlay" | "marker";

export type AssetManifestItem = {
  id: string;
  name: string;
  path: string;
  pack: "base" | "extended";
  framePx: { w: number; h: number };
  category: string;
  tags: string[];
  inferredLayer: AssetLayerHint;
};

export type EditorTool = "brush" | "erase" | "fill" | "line" | "select" | "label" | "fog";

export type EditorSelection = {
  cells: string[];
};

export type EditorSnapshot = {
  cells: Record<string, HexLayerSet>;
  bounds: MapBounds;
  calibration: GridCalibration;
  selection: EditorSelection;
};

export const DEFAULT_CELL: HexLayerSet = {
  baseTileId: null,
  overlayTileIds: [],
  markerTileIds: [],
  fog: "none",
};

export const DEFAULT_CALIBRATION: GridCalibration = {
  orientation: "flat-top",
  hexSizePx: 59,
  originPx: { x: 380, y: 220 },
  tileFramePx: { w: 224, h: 194 },
  spriteAnchorPx: { x: 112, y: 102 },
  manualNudgePx: { x: 0, y: 0 },
};

export const DEFAULT_BOUNDS: MapBounds = {
  minQ: 0,
  maxQ: 47,
  minR: 0,
  maxR: 31,
};
