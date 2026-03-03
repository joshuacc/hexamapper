import { z } from "zod";
import {
  DEFAULT_BOUNDS,
  DEFAULT_CALIBRATION,
  DEFAULT_CELL,
  type HexLayerSet,
  type HexProjectV1,
  type MapBounds,
} from "./types";

const mapBoundsSchema = z.object({
  minQ: z.number().int(),
  maxQ: z.number().int(),
  minR: z.number().int(),
  maxR: z.number().int(),
});

const labelSchema = z.object({
  text: z.string(),
  style: z.enum(["small", "title"]),
  color: z.string(),
  offsetPx: z.object({ x: z.number(), y: z.number() }),
});

const layerSetSchema: z.ZodType<HexLayerSet> = z.object({
  baseTileId: z.string().nullable(),
  overlayTileIds: z.array(z.string()),
  markerTileIds: z.array(z.string()),
  fog: z.enum(["none", "light", "full"]),
  label: labelSchema.optional(),
  notes: z.string().optional(),
});

const calibrationSchema = z.object({
  orientation: z.literal("flat-top"),
  hexSizePx: z.number().positive(),
  originPx: z.object({ x: z.number(), y: z.number() }),
  tileFramePx: z.object({ w: z.number().positive(), h: z.number().positive() }),
  spriteAnchorPx: z.object({ x: z.number(), y: z.number() }),
  manualNudgePx: z.object({ x: z.number(), y: z.number() }),
});

const projectSchema: z.ZodType<HexProjectV1> = z.object({
  version: z.literal(1),
  metadata: z.object({
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    tileSet: z.literal("vtt-72"),
    coordinateSystem: z.literal("axial"),
    maxBounds: mapBoundsSchema,
  }),
  calibration: calibrationSchema,
  cells: z.record(z.string(), layerSetSchema),
});

function normalizeBounds(bounds: MapBounds): MapBounds {
  if (bounds.maxQ < bounds.minQ || bounds.maxR < bounds.minR) {
    return DEFAULT_BOUNDS;
  }
  return bounds;
}

function normalizeCell(cell: HexLayerSet): HexLayerSet {
  return {
    baseTileId: cell.baseTileId,
    overlayTileIds: [...new Set(cell.overlayTileIds)].slice(0, 32),
    markerTileIds: [...new Set(cell.markerTileIds)].slice(0, 32),
    fog: cell.fog,
    label: cell.label,
    notes: cell.notes,
  };
}

export function sanitizeCells(cells: Record<string, HexLayerSet>): Record<string, HexLayerSet> {
  const out: Record<string, HexLayerSet> = {};
  for (const [key, value] of Object.entries(cells)) {
    const cell = normalizeCell(value);
    const isEmpty =
      !cell.baseTileId &&
      cell.overlayTileIds.length === 0 &&
      cell.markerTileIds.length === 0 &&
      cell.fog === "none" &&
      !cell.label &&
      !cell.notes;

    if (!isEmpty) {
      out[key] = cell;
    }
  }

  return out;
}

export function parseProject(raw: unknown): HexProjectV1 {
  const parsed = projectSchema.parse(raw);
  return {
    ...parsed,
    metadata: {
      ...parsed.metadata,
      maxBounds: normalizeBounds(parsed.metadata.maxBounds),
      updatedAt: new Date().toISOString(),
    },
    calibration: {
      ...DEFAULT_CALIBRATION,
      ...parsed.calibration,
      originPx: { ...DEFAULT_CALIBRATION.originPx, ...parsed.calibration.originPx },
      tileFramePx: { ...DEFAULT_CALIBRATION.tileFramePx, ...parsed.calibration.tileFramePx },
      spriteAnchorPx: { ...DEFAULT_CALIBRATION.spriteAnchorPx, ...parsed.calibration.spriteAnchorPx },
      manualNudgePx: { ...DEFAULT_CALIBRATION.manualNudgePx, ...parsed.calibration.manualNudgePx },
    },
    cells: sanitizeCells(parsed.cells),
  };
}

export function createProject(name = "Untitled Region", bounds: MapBounds = DEFAULT_BOUNDS): HexProjectV1 {
  const now = new Date().toISOString();

  return {
    version: 1,
    metadata: {
      name,
      createdAt: now,
      updatedAt: now,
      tileSet: "vtt-72",
      coordinateSystem: "axial",
      maxBounds: bounds,
    },
    calibration: structuredClone(DEFAULT_CALIBRATION),
    cells: {},
  };
}

export function emptyCell(): HexLayerSet {
  return structuredClone(DEFAULT_CELL);
}
