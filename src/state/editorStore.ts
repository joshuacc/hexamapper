import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  AXIAL_DIRECTIONS,
  axialKey,
  axialLine,
  isWithinBounds,
  iterateBounds,
  neighbors,
  parseAxialKey,
} from "../domain/hexMath";
import { createProject, emptyCell, sanitizeCells } from "../domain/projectSchema";
import {
  DEFAULT_BOUNDS,
  type AxialCoord,
  type EditorLayer,
  type EditorSelection,
  type EditorSnapshot,
  type EditorTool,
  type FogLevel,
  type GridCalibration,
  type HexLayerSet,
  type HexProjectV1,
  type MapBounds,
} from "../domain/types";

const HISTORY_LIMIT = 120;
const DEFAULT_BLANK_BASE_TILE_ID = "base:hex-base-blank";

export type EditorStoreState = {
  project: HexProjectV1;
  activeTool: EditorTool;
  activeLayer: EditorLayer;
  selectedTileId: string | null;
  fogBrushLevel: FogLevel;
  hoverCoord: AxialCoord | null;
  selection: EditorSelection;
  searchQuery: string;
  selectedCategory: string | "All";
  showGrid: boolean;
  lineStart: AxialCoord | null;
  lastStatusMessage: string;

  historyPast: EditorSnapshot[];
  historyFuture: EditorSnapshot[];
  pendingStrokeSnapshot: EditorSnapshot | null;
  pendingStrokeDirty: boolean;

  setTool: (tool: EditorTool) => void;
  setLayer: (layer: EditorLayer) => void;
  setSelectedTile: (tileId: string | null) => void;
  setFogBrushLevel: (level: FogLevel) => void;
  setHoverCoord: (coord: AxialCoord | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | "All") => void;
  setShowGrid: (show: boolean) => void;

  beginStroke: () => void;
  commitStroke: () => void;
  paintAt: (coord: AxialCoord) => void;
  eraseAt: (coord: AxialCoord) => void;
  fillFrom: (coord: AxialCoord) => void;
  lineTo: (coord: AxialCoord) => void;
  clearLineStart: () => void;
  setFogAt: (coord: AxialCoord) => void;

  selectOnly: (coord: AxialCoord) => void;
  toggleSelectionCell: (coord: AxialCoord) => void;
  selectMany: (coords: AxialCoord[]) => void;
  clearSelection: () => void;
  moveSelection: (direction: (typeof AXIAL_DIRECTIONS)[number]) => void;

  setSelectedCellLabel: (label: string) => void;
  setSelectedCellNotes: (notes: string) => void;
  setSelectedCellFog: (fog: FogLevel) => void;
  removeSelectedCellLabel: () => void;

  updateCalibration: (updater: (prev: GridCalibration) => GridCalibration) => void;
  setBounds: (bounds: MapBounds) => void;
  newProject: (name: string, bounds: MapBounds) => void;
  loadProject: (project: HexProjectV1) => void;

  undo: () => void;
  redo: () => void;
};

function cloneCell(cell: HexLayerSet): HexLayerSet {
  return {
    baseTileId: cell.baseTileId,
    overlayTileIds: [...cell.overlayTileIds],
    markerTileIds: [...cell.markerTileIds],
    fog: cell.fog,
    label: cell.label ? { ...cell.label, offsetPx: { ...cell.label.offsetPx } } : undefined,
    notes: cell.notes,
  };
}

function cloneCells(cells: Record<string, HexLayerSet>): Record<string, HexLayerSet> {
  const out: Record<string, HexLayerSet> = {};
  for (const [key, value] of Object.entries(cells)) {
    out[key] = cloneCell(value);
  }
  return out;
}

function snapshot(state: EditorStoreState): EditorSnapshot {
  return {
    cells: cloneCells(state.project.cells),
    bounds: { ...state.project.metadata.maxBounds },
    calibration: {
      ...state.project.calibration,
      originPx: { ...state.project.calibration.originPx },
      tileFramePx: { ...state.project.calibration.tileFramePx },
      spriteAnchorPx: { ...state.project.calibration.spriteAnchorPx },
      manualNudgePx: { ...state.project.calibration.manualNudgePx },
    },
    selection: { cells: [...state.selection.cells] },
  };
}

function restoreFromSnapshot(state: EditorStoreState, next: EditorSnapshot): void {
  state.project.cells = cloneCells(next.cells);
  state.project.metadata.maxBounds = { ...next.bounds };
  state.project.calibration = {
    ...next.calibration,
    originPx: { ...next.calibration.originPx },
    tileFramePx: { ...next.calibration.tileFramePx },
    spriteAnchorPx: { ...next.calibration.spriteAnchorPx },
    manualNudgePx: { ...next.calibration.manualNudgePx },
  };
  state.selection = { cells: [...next.selection.cells] };
}

function markTouched(state: EditorStoreState): void {
  state.project.metadata.updatedAt = new Date().toISOString();
}

function pushPast(state: EditorStoreState, previous: EditorSnapshot): void {
  state.historyPast.push(previous);
  if (state.historyPast.length > HISTORY_LIMIT) {
    state.historyPast.shift();
  }
  state.historyFuture = [];
}

function withHistory(state: EditorStoreState, mutate: () => boolean): void {
  const before = snapshot(state);
  const changed = mutate();
  if (changed) {
    pushPast(state, before);
    markTouched(state);
  }
}

function getCell(state: EditorStoreState, key: string): HexLayerSet {
  return cloneCell(state.project.cells[key] ?? emptyCell());
}

function isCellTrulyEmpty(cell: HexLayerSet): boolean {
  return (
    !cell.baseTileId &&
    cell.overlayTileIds.length === 0 &&
    cell.markerTileIds.length === 0 &&
    cell.fog === "none" &&
    !cell.label &&
    !(cell.notes && cell.notes.trim().length > 0)
  );
}

function writeCell(state: EditorStoreState, key: string, nextCell: HexLayerSet): boolean {
  const normalized = sanitizeCells({ [key]: nextCell });
  const previous = state.project.cells[key];
  const next = normalized[key];

  if (!next && !previous) {
    return false;
  }

  if (next && previous && JSON.stringify(next) === JSON.stringify(previous)) {
    return false;
  }

  if (!next) {
    delete state.project.cells[key];
    return true;
  }

  state.project.cells[key] = next;
  return true;
}

function applyBrushToCell(
  cell: HexLayerSet,
  layer: EditorLayer,
  selectedTileId: string | null,
  fogBrushLevel: FogLevel,
): HexLayerSet {
  const next = cloneCell(cell);

  if (layer === "fog") {
    next.fog = fogBrushLevel;
    return next;
  }

  if (!selectedTileId) {
    return next;
  }

  if (layer === "base") {
    next.baseTileId = selectedTileId;
    next.overlayTileIds = [];
    return next;
  }

  if (layer === "overlay") {
    next.overlayTileIds = [selectedTileId];
    return next;
  }

  next.markerTileIds = [selectedTileId];
  return next;
}

function applyEraseToCell(
  cell: HexLayerSet,
  layer: EditorLayer,
  selectedTileId: string | null,
): HexLayerSet {
  const next = cloneCell(cell);

  if (layer === "base") {
    next.baseTileId = null;
    return next;
  }

  if (layer === "overlay") {
    if (selectedTileId) {
      next.overlayTileIds = next.overlayTileIds.filter((id) => id !== selectedTileId);
    } else {
      next.overlayTileIds.pop();
    }
    return next;
  }

  if (layer === "marker") {
    if (selectedTileId) {
      next.markerTileIds = next.markerTileIds.filter((id) => id !== selectedTileId);
    } else {
      next.markerTileIds.pop();
    }
    return next;
  }

  next.fog = "none";
  return next;
}

function readLayerToken(cell: HexLayerSet, layer: EditorLayer): string {
  if (layer === "base") {
    return cell.baseTileId ?? "";
  }

  if (layer === "overlay") {
    return cell.overlayTileIds[cell.overlayTileIds.length - 1] ?? "";
  }

  if (layer === "marker") {
    return cell.markerTileIds[cell.markerTileIds.length - 1] ?? "";
  }

  return cell.fog;
}

function setLayerToken(cell: HexLayerSet, layer: EditorLayer, token: string): HexLayerSet {
  const next = cloneCell(cell);

  if (layer === "base") {
    next.baseTileId = token || null;
    return next;
  }

  if (layer === "overlay") {
    next.overlayTileIds = token ? [token] : [];
    return next;
  }

  if (layer === "marker") {
    next.markerTileIds = token ? [token] : [];
    return next;
  }

  next.fog = token === "light" || token === "full" ? token : "none";
  return next;
}

function createBlankBaseFilledCells(bounds: MapBounds): Record<string, HexLayerSet> {
  const cells: Record<string, HexLayerSet> = {};
  for (const coord of iterateBounds(bounds)) {
    cells[axialKey(coord)] = {
      baseTileId: DEFAULT_BLANK_BASE_TILE_ID,
      overlayTileIds: [],
      markerTileIds: [],
      fog: "none",
    };
  }
  return cells;
}

function createDefaultProject(name: string, bounds: MapBounds): HexProjectV1 {
  const project = createProject(name, bounds);
  project.cells = createBlankBaseFilledCells(bounds);
  return project;
}

const INITIAL_PROJECT = createDefaultProject("Untitled Region", DEFAULT_BOUNDS);

export const useEditorStore = create<EditorStoreState>()(
  immer((set) => ({
    project: INITIAL_PROJECT,
    activeTool: "brush",
    activeLayer: "base",
    selectedTileId: null,
    fogBrushLevel: "full",
    hoverCoord: null,
    selection: { cells: [] },
    searchQuery: "",
    selectedCategory: "All",
    showGrid: true,
    lineStart: null,
    lastStatusMessage: "Ready",

    historyPast: [],
    historyFuture: [],
    pendingStrokeSnapshot: null,
    pendingStrokeDirty: false,

    setTool: (tool) => {
      set((state) => {
        state.activeTool = tool;
        if (tool !== "line") {
          state.lineStart = null;
        }
      });
    },

    setLayer: (layer) => {
      set((state) => {
        state.activeLayer = layer;
      });
    },

    setSelectedTile: (tileId) => {
      set((state) => {
        state.selectedTileId = tileId;
      });
    },

    setFogBrushLevel: (level) => {
      set((state) => {
        state.fogBrushLevel = level;
      });
    },

    setHoverCoord: (coord) => {
      set((state) => {
        state.hoverCoord = coord;
      });
    },

    setSearchQuery: (query) => {
      set((state) => {
        state.searchQuery = query;
      });
    },

    setSelectedCategory: (category) => {
      set((state) => {
        state.selectedCategory = category;
      });
    },

    setShowGrid: (show) => {
      set((state) => {
        state.showGrid = show;
      });
    },

    beginStroke: () => {
      set((state) => {
        if (!state.pendingStrokeSnapshot) {
          state.pendingStrokeSnapshot = snapshot(state);
          state.pendingStrokeDirty = false;
        }
      });
    },

    commitStroke: () => {
      set((state) => {
        if (state.pendingStrokeSnapshot && state.pendingStrokeDirty) {
          pushPast(state, state.pendingStrokeSnapshot);
          markTouched(state);
        }
        state.pendingStrokeSnapshot = null;
        state.pendingStrokeDirty = false;
      });
    },

    paintAt: (coord) => {
      set((state) => {
        if (!isWithinBounds(coord, state.project.metadata.maxBounds)) {
          return;
        }

        const before = state.pendingStrokeSnapshot ? null : snapshot(state);
        const key = axialKey(coord);
        const previous = getCell(state, key);
        const next = applyBrushToCell(previous, state.activeLayer, state.selectedTileId, state.fogBrushLevel);
        const changed = writeCell(state, key, next);

        if (changed) {
          if (state.pendingStrokeSnapshot) {
            state.pendingStrokeDirty = true;
          } else if (before) {
            pushPast(state, before);
          }
          state.lastStatusMessage = `Painted ${key}`;
          markTouched(state);
        }
      });
    },

    eraseAt: (coord) => {
      set((state) => {
        if (!isWithinBounds(coord, state.project.metadata.maxBounds)) {
          return;
        }

        const before = state.pendingStrokeSnapshot ? null : snapshot(state);
        const key = axialKey(coord);
        const previous = getCell(state, key);
        const next = applyEraseToCell(previous, state.activeLayer, state.selectedTileId);
        const changed = writeCell(state, key, next);

        if (changed) {
          if (state.pendingStrokeSnapshot) {
            state.pendingStrokeDirty = true;
          } else if (before) {
            pushPast(state, before);
          }
          state.lastStatusMessage = `Erased ${key}`;
          markTouched(state);
        }
      });
    },

    fillFrom: (startCoord) => {
      set((state) => {
        if (!isWithinBounds(startCoord, state.project.metadata.maxBounds)) {
          return;
        }

        const replacementToken =
          state.activeLayer === "fog"
            ? state.fogBrushLevel
            : state.selectedTileId ?? "";

        if (state.activeLayer !== "fog" && !replacementToken) {
          state.lastStatusMessage = "Pick a tile before filling.";
          return;
        }

        withHistory(state, () => {
          const startKey = axialKey(startCoord);
          const targetToken = readLayerToken(getCell(state, startKey), state.activeLayer);

          if (targetToken === replacementToken) {
            return false;
          }

          const queue: AxialCoord[] = [startCoord];
          const visited = new Set<string>([startKey]);
          let changedCount = 0;

          while (queue.length > 0) {
            const coord = queue.shift();
            if (!coord) {
              continue;
            }

            const key = axialKey(coord);
            const currentCell = getCell(state, key);
            const token = readLayerToken(currentCell, state.activeLayer);
            if (token !== targetToken) {
              continue;
            }

            const updatedCell = setLayerToken(currentCell, state.activeLayer, replacementToken);
            if (writeCell(state, key, updatedCell)) {
              changedCount += 1;
            }

            for (const neighbor of neighbors(coord)) {
              if (!isWithinBounds(neighbor, state.project.metadata.maxBounds)) {
                continue;
              }
              const neighborKey = axialKey(neighbor);
              if (!visited.has(neighborKey)) {
                visited.add(neighborKey);
                queue.push(neighbor);
              }
            }
          }

          state.lastStatusMessage = `Filled ${changedCount} hexes`;
          return changedCount > 0;
        });
      });
    },

    lineTo: (targetCoord) => {
      set((state) => {
        if (!isWithinBounds(targetCoord, state.project.metadata.maxBounds)) {
          return;
        }

        if (!state.lineStart) {
          state.lineStart = targetCoord;
          state.lastStatusMessage = "Line start set";
          return;
        }

        const start = state.lineStart;
        state.lineStart = null;

        withHistory(state, () => {
          const points = axialLine(start, targetCoord);
          let changed = false;

          for (const point of points) {
            if (!isWithinBounds(point, state.project.metadata.maxBounds)) {
              continue;
            }
            const key = axialKey(point);
            const beforeCell = getCell(state, key);
            const afterCell = applyBrushToCell(
              beforeCell,
              state.activeLayer,
              state.selectedTileId,
              state.fogBrushLevel,
            );
            const didWrite = writeCell(state, key, afterCell);
            changed = changed || didWrite;
          }

          if (changed) {
            state.lastStatusMessage = `Drew line across ${points.length} hexes`;
          }
          return changed;
        });
      });
    },

    clearLineStart: () => {
      set((state) => {
        state.lineStart = null;
      });
    },

    setFogAt: (coord) => {
      set((state) => {
        if (!isWithinBounds(coord, state.project.metadata.maxBounds)) {
          return;
        }

        const before = state.pendingStrokeSnapshot ? null : snapshot(state);
        const key = axialKey(coord);
        const cell = getCell(state, key);
        if (cell.fog === state.fogBrushLevel) {
          return;
        }

        cell.fog = state.fogBrushLevel;
        const changed = writeCell(state, key, cell);
        if (!changed) {
          return;
        }

        if (state.pendingStrokeSnapshot) {
          state.pendingStrokeDirty = true;
        } else if (before) {
          pushPast(state, before);
        }

        state.lastStatusMessage = `Fog set on ${key}`;
        markTouched(state);
      });
    },

    selectOnly: (coord) => {
      set((state) => {
        const key = axialKey(coord);
        state.selection.cells = [key];
      });
    },

    toggleSelectionCell: (coord) => {
      set((state) => {
        const key = axialKey(coord);
        if (state.selection.cells.includes(key)) {
          state.selection.cells = state.selection.cells.filter((value) => value !== key);
        } else {
          state.selection.cells.push(key);
        }
      });
    },

    selectMany: (coords) => {
      set((state) => {
        const keys = coords.map(axialKey);
        state.selection.cells = [...new Set(keys)];
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selection.cells = [];
      });
    },

    moveSelection: (direction) => {
      set((state) => {
        if (state.selection.cells.length === 0) {
          return;
        }

        withHistory(state, () => {
          const [dq, dr] = direction;
          const movingEntries = state.selection.cells
            .map((key) => ({
              fromKey: key,
              fromCoord: parseAxialKey(key),
              cell: state.project.cells[key] ? cloneCell(state.project.cells[key]) : null,
            }))
            .filter((entry) => entry.cell !== null);

          if (movingEntries.length === 0) {
            return false;
          }

          const validEntries = movingEntries.filter((entry) =>
            isWithinBounds(
              { q: entry.fromCoord.q + dq, r: entry.fromCoord.r + dr },
              state.project.metadata.maxBounds,
            ),
          );

          if (validEntries.length === 0) {
            return false;
          }

          for (const entry of validEntries) {
            delete state.project.cells[entry.fromKey];
          }

          const nextSelection: string[] = [];
          let changed = false;

          for (const entry of validEntries) {
            const toCoord = { q: entry.fromCoord.q + dq, r: entry.fromCoord.r + dr };
            const toKey = axialKey(toCoord);
            if (entry.cell) {
              state.project.cells[toKey] = entry.cell;
              nextSelection.push(toKey);
              changed = true;
            }
          }

          state.selection.cells = nextSelection;
          if (changed) {
            state.lastStatusMessage = `Moved ${nextSelection.length} selected hexes`;
          }
          return changed;
        });
      });
    },

    setSelectedCellLabel: (label) => {
      set((state) => {
        const first = state.selection.cells[0];
        if (!first) {
          return;
        }

        withHistory(state, () => {
          const cell = getCell(state, first);
          if (!label.trim()) {
            if (!cell.label) {
              return false;
            }
            delete cell.label;
          } else {
            cell.label = {
              text: label,
              style: cell.label?.style ?? "small",
              color: cell.label?.color ?? "#f7f0d1",
              offsetPx: cell.label?.offsetPx ?? { x: 0, y: -40 },
            };
          }
          return writeCell(state, first, cell);
        });
      });
    },

    setSelectedCellNotes: (notes) => {
      set((state) => {
        const first = state.selection.cells[0];
        if (!first) {
          return;
        }

        withHistory(state, () => {
          const cell = getCell(state, first);
          cell.notes = notes.trim().length > 0 ? notes : undefined;
          return writeCell(state, first, cell);
        });
      });
    },

    setSelectedCellFog: (fog) => {
      set((state) => {
        const first = state.selection.cells[0];
        if (!first) {
          return;
        }

        withHistory(state, () => {
          const cell = getCell(state, first);
          cell.fog = fog;
          return writeCell(state, first, cell);
        });
      });
    },

    removeSelectedCellLabel: () => {
      set((state) => {
        const first = state.selection.cells[0];
        if (!first) {
          return;
        }

        withHistory(state, () => {
          const cell = getCell(state, first);
          if (!cell.label) {
            return false;
          }
          delete cell.label;
          return writeCell(state, first, cell);
        });
      });
    },

    updateCalibration: (updater) => {
      set((state) => {
        withHistory(state, () => {
          const next = updater(state.project.calibration);
          const changed = JSON.stringify(next) !== JSON.stringify(state.project.calibration);
          if (!changed) {
            return false;
          }
          state.project.calibration = next;
          state.lastStatusMessage = "Calibration updated";
          return true;
        });
      });
    },

    setBounds: (bounds) => {
      set((state) => {
        withHistory(state, () => {
          if (bounds.maxQ < bounds.minQ || bounds.maxR < bounds.minR) {
            state.lastStatusMessage = "Invalid bounds: max must be >= min.";
            return false;
          }

          if (JSON.stringify(bounds) === JSON.stringify(state.project.metadata.maxBounds)) {
            return false;
          }

          state.project.metadata.maxBounds = { ...bounds };
          // Remove cells outside new bounds.
          for (const key of Object.keys(state.project.cells)) {
            const coord = parseAxialKey(key);
            if (!isWithinBounds(coord, bounds)) {
              delete state.project.cells[key];
            }
          }

          state.selection.cells = state.selection.cells.filter((key) => {
            const coord = parseAxialKey(key);
            return isWithinBounds(coord, bounds);
          });
          state.lastStatusMessage = "Map bounds updated";
          return true;
        });
      });
    },

    newProject: (name, bounds) => {
      set((state) => {
        const project = createDefaultProject(name || "Untitled Region", bounds);
        state.project = project;
        state.selection = { cells: [] };
        state.hoverCoord = null;
        state.lineStart = null;
        state.historyPast = [];
        state.historyFuture = [];
        state.pendingStrokeSnapshot = null;
        state.pendingStrokeDirty = false;
        state.lastStatusMessage = "New project created";
      });
    },

    loadProject: (project) => {
      set((state) => {
        state.project = project;
        state.selection = { cells: [] };
        state.hoverCoord = null;
        state.lineStart = null;
        state.historyPast = [];
        state.historyFuture = [];
        state.pendingStrokeSnapshot = null;
        state.pendingStrokeDirty = false;
        state.lastStatusMessage = "Project loaded";
      });
    },

    undo: () => {
      set((state) => {
        const previous = state.historyPast.pop();
        if (!previous) {
          return;
        }

        const current = snapshot(state);
        state.historyFuture.push(current);
        restoreFromSnapshot(state, previous);
        state.pendingStrokeSnapshot = null;
        state.pendingStrokeDirty = false;
        state.lastStatusMessage = "Undid action";
      });
    },

    redo: () => {
      set((state) => {
        const future = state.historyFuture.pop();
        if (!future) {
          return;
        }

        const current = snapshot(state);
        state.historyPast.push(current);
        restoreFromSnapshot(state, future);
        state.pendingStrokeSnapshot = null;
        state.pendingStrokeDirty = false;
        state.lastStatusMessage = "Redid action";
      });
    },
  })),
);

export function selectedPrimaryCell(state: EditorStoreState): { key: string; cell: HexLayerSet } | null {
  const first = state.selection.cells[0];
  if (!first) {
    return null;
  }

  return {
    key: first,
    cell: state.project.cells[first] ? cloneCell(state.project.cells[first]) : emptyCell(),
  };
}

export function orderedSelectionCoords(state: EditorStoreState): AxialCoord[] {
  return state.selection.cells.map(parseAxialKey);
}

export function normalizeLoadedProject(project: HexProjectV1): HexProjectV1 {
  const bounds = project.metadata.maxBounds ?? DEFAULT_BOUNDS;
  const sanitizedCells = sanitizeCells(project.cells);
  const migratedCells = maybeMigrateLegacyRectangularCoords(sanitizedCells, bounds);

  return {
    ...project,
    metadata: {
      ...project.metadata,
      maxBounds: bounds,
    },
    cells: migratedCells,
  };
}

function legacyIsWithinBounds(coord: AxialCoord, bounds: MapBounds): boolean {
  return (
    coord.q >= bounds.minQ &&
    coord.q <= bounds.maxQ &&
    coord.r >= bounds.minR &&
    coord.r <= bounds.maxR
  );
}

function rowOffsetForQ(q: number): number {
  return Math.floor((q - (q & 1)) / 2);
}

function maybeMigrateLegacyRectangularCoords(
  cells: Record<string, HexLayerSet>,
  bounds: MapBounds,
): Record<string, HexLayerSet> {
  const entries = Object.entries(cells);
  if (entries.length === 0) {
    return cells;
  }

  let legacyCount = 0;
  let currentCount = 0;

  for (const [key] of entries) {
    const coord = parseAxialKey(key);
    if (legacyIsWithinBounds(coord, bounds)) {
      legacyCount += 1;
    }
    if (isWithinBounds(coord, bounds)) {
      currentCount += 1;
    }
  }

  const delta = legacyCount - currentCount;
  const minimumDelta = Math.max(2, Math.floor(entries.length * 0.08));
  const shouldMigrate = legacyCount >= Math.ceil(currentCount * 1.2) && delta >= minimumDelta;
  if (!shouldMigrate) {
    return cells;
  }

  const migrated: Record<string, HexLayerSet> = {};
  for (const [key, cell] of entries) {
    const coord = parseAxialKey(key);
    const migratedCoord = { q: coord.q, r: coord.r - rowOffsetForQ(coord.q) };
    if (!isWithinBounds(migratedCoord, bounds)) {
      continue;
    }
    migrated[axialKey(migratedCoord)] = cell;
  }

  return migrated;
}

export const MOVE_DIRECTIONS: Array<{ name: string; delta: (typeof AXIAL_DIRECTIONS)[number] }> = [
  { name: "E", delta: AXIAL_DIRECTIONS[0] },
  { name: "NE", delta: AXIAL_DIRECTIONS[1] },
  { name: "NW", delta: AXIAL_DIRECTIONS[2] },
  { name: "W", delta: AXIAL_DIRECTIONS[3] },
  { name: "SW", delta: AXIAL_DIRECTIONS[4] },
  { name: "SE", delta: AXIAL_DIRECTIONS[5] },
];

export function canPaint(state: EditorStoreState): boolean {
  if (state.activeLayer === "fog") {
    return true;
  }

  return Boolean(state.selectedTileId);
}

export function selectionSummary(state: EditorStoreState): string {
  if (state.selection.cells.length === 0) {
    return "No selection";
  }

  if (state.selection.cells.length === 1) {
    return `Selected ${state.selection.cells[0]}`;
  }

  return `${state.selection.cells.length} hexes selected`;
}

export function isHexCellFilled(cell: HexLayerSet): boolean {
  return !isCellTrulyEmpty(cell);
}
