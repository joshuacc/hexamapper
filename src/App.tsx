import { useCallback, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import "./styles.css";
import { parseProject } from "./domain/projectSchema";
import { emptyCell } from "./domain/projectSchema";
import type { AxialCoord, HexProjectV1, MapBounds } from "./domain/types";
import { useAutosave, readAutosave } from "./hooks/useAutosave";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { renderProjectToBlob, downloadBlob } from "./lib/exportPng";
import { PixiMapCanvas } from "./renderer/PixiMapCanvas";
import {
  canPaint,
  normalizeLoadedProject,
  selectionSummary,
  useEditorStore,
} from "./state/editorStore";
import { groupedCategories, manifestById, searchManifest } from "./data/manifest";
import { InspectorPanel } from "./ui/InspectorPanel";
import { PalettePanel } from "./ui/PalettePanel";
import { StatusBar } from "./ui/StatusBar";
import { Toolbar } from "./ui/Toolbar";

function parseBoundsFromPrompt(defaults: MapBounds): MapBounds {
  const widthRaw = window.prompt("Map width in hexes (q-axis)", String(defaults.maxQ - defaults.minQ + 1));
  const heightRaw = window.prompt("Map height in hexes (r-axis)", String(defaults.maxR - defaults.minR + 1));

  const width = Math.max(1, Number.parseInt(widthRaw ?? "", 10) || 48);
  const height = Math.max(1, Number.parseInt(heightRaw ?? "", 10) || 32);

  return {
    minQ: 0,
    maxQ: width - 1,
    minR: 0,
    maxR: height - 1,
  };
}

function toFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "hexamap";
}

export default function App() {
  useAutosave();
  useKeyboardShortcuts();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const project = useEditorStore((state) => state.project);
  const activeTool = useEditorStore((state) => state.activeTool);
  const activeLayer = useEditorStore((state) => state.activeLayer);
  const selectedTileId = useEditorStore((state) => state.selectedTileId);
  const fogBrushLevel = useEditorStore((state) => state.fogBrushLevel);
  const selection = useEditorStore((state) => state.selection.cells);
  const searchQuery = useEditorStore((state) => state.searchQuery);
  const selectedCategory = useEditorStore((state) => state.selectedCategory);
  const lineStart = useEditorStore((state) => state.lineStart);
  const statusMessage = useEditorStore((state) => state.lastStatusMessage);
  const historyPastLength = useEditorStore((state) => state.historyPast.length);
  const historyFutureLength = useEditorStore((state) => state.historyFuture.length);

  const setTool = useEditorStore((state) => state.setTool);
  const setLayer = useEditorStore((state) => state.setLayer);
  const setSelectedTile = useEditorStore((state) => state.setSelectedTile);
  const setFogBrushLevel = useEditorStore((state) => state.setFogBrushLevel);
  const setHoverCoord = useEditorStore((state) => state.setHoverCoord);
  const setSearchQuery = useEditorStore((state) => state.setSearchQuery);
  const setSelectedCategory = useEditorStore((state) => state.setSelectedCategory);

  const beginStroke = useEditorStore((state) => state.beginStroke);
  const commitStroke = useEditorStore((state) => state.commitStroke);
  const paintAt = useEditorStore((state) => state.paintAt);
  const eraseAt = useEditorStore((state) => state.eraseAt);
  const fillFrom = useEditorStore((state) => state.fillFrom);
  const lineTo = useEditorStore((state) => state.lineTo);
  const setFogAt = useEditorStore((state) => state.setFogAt);

  const selectOnly = useEditorStore((state) => state.selectOnly);
  const toggleSelectionCell = useEditorStore((state) => state.toggleSelectionCell);
  const moveSelection = useEditorStore((state) => state.moveSelection);
  const setSelectedCellLabel = useEditorStore((state) => state.setSelectedCellLabel);
  const setSelectedCellNotes = useEditorStore((state) => state.setSelectedCellNotes);
  const setSelectedCellFog = useEditorStore((state) => state.setSelectedCellFog);
  const removeSelectedCellLabel = useEditorStore((state) => state.removeSelectedCellLabel);
  const updateCalibration = useEditorStore((state) => state.updateCalibration);
  const setBounds = useEditorStore((state) => state.setBounds);
  const newProject = useEditorStore((state) => state.newProject);
  const loadProject = useEditorStore((state) => state.loadProject);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  useEffect(() => {
    const autosave = readAutosave();
    if (!autosave) {
      return;
    }

    try {
      const parsed = normalizeLoadedProject(parseProject(autosave));
      loadProject(parsed);
    } catch {
      // Ignore invalid autosave data.
    }
  }, [loadProject]);

  useEffect(() => {
    if (selectedTileId) {
      return;
    }

    const baseTiles = searchManifest("", "base");
    const preferredBaseTile =
      baseTiles.find((item) => /^hex - base \(lush\)$/i.test(item.name)) ??
      baseTiles.find((item) => /\blush\b/i.test(item.name));
    const firstBaseTile =
      preferredBaseTile ?? baseTiles.find((item) => !/\bblank\b/i.test(item.name)) ?? baseTiles[0];
    if (firstBaseTile) {
      setSelectedTile(firstBaseTile.id);
    }
  }, [selectedTileId, setSelectedTile]);

  const selectedTileName = selectedTileId ? manifestById.get(selectedTileId)?.name ?? selectedTileId : "(none)";

  const filteredItems = useMemo(() => {
    const items = searchManifest(searchQuery, activeLayer === "fog" ? "all" : activeLayer);
    if (selectedCategory === "All") {
      return items;
    }
    return items.filter((item) => item.category === selectedCategory);
  }, [activeLayer, searchQuery, selectedCategory]);

  const categories = useMemo(() => groupedCategories(filteredItems), [filteredItems]);

  const selectedKey = selection[0] ?? null;
  const selectedCell = selectedKey ? project.cells[selectedKey] ?? emptyCell() : null;

  const onPickTile = useCallback(
    (tileId: string) => {
      setSelectedTile(tileId);
      const item = manifestById.get(tileId);
      if (!item) {
        return;
      }
      if (activeLayer !== item.inferredLayer && activeLayer !== "fog") {
        setLayer(item.inferredLayer);
      }
    },
    [activeLayer, setLayer, setSelectedTile],
  );

  const onPrimaryAction = useCallback(
    (coord: AxialCoord, shiftKey: boolean) => {
      if (activeTool === "brush") {
        paintAt(coord);
        return;
      }

      if (activeTool === "erase") {
        eraseAt(coord);
        return;
      }

      if (activeTool === "fill") {
        fillFrom(coord);
        return;
      }

      if (activeTool === "line") {
        lineTo(coord);
        return;
      }

      if (activeTool === "label") {
        selectOnly(coord);
        return;
      }

      if (activeTool === "fog") {
        setFogAt(coord);
        return;
      }

      if (shiftKey) {
        toggleSelectionCell(coord);
      } else {
        selectOnly(coord);
      }
    },
    [activeTool, eraseAt, fillFrom, lineTo, paintAt, selectOnly, setFogAt, toggleSelectionCell],
  );

  const onDragAction = useCallback(
    (coord: AxialCoord) => {
      if (activeTool === "brush") {
        paintAt(coord);
      } else if (activeTool === "erase") {
        eraseAt(coord);
      } else if (activeTool === "fog") {
        setFogAt(coord);
      }
    },
    [activeTool, eraseAt, paintAt, setFogAt],
  );

  const onStrokeStart = useCallback(() => {
    beginStroke();
  }, [beginStroke]);

  const onStrokeEnd = useCallback(() => {
    commitStroke();
  }, [commitStroke]);

  const onNewProject = useCallback(() => {
    const name = window.prompt("Project name", project.metadata.name) ?? project.metadata.name;
    const bounds = parseBoundsFromPrompt(project.metadata.maxBounds);
    newProject(name, bounds);
  }, [newProject, project.metadata.maxBounds, project.metadata.name]);

  const onLoadProject = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onSaveProject = useCallback(() => {
    const payload: HexProjectV1 = {
      ...project,
      metadata: {
        ...project.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${toFilename(project.metadata.name)}.hexamap.json`);
  }, [project]);

  const onExportPng = useCallback(async () => {
    try {
      const blob = await renderProjectToBlob(project, manifestById);
      downloadBlob(blob, `${toFilename(project.metadata.name)}.png`);
    } catch (error) {
      window.alert(`PNG export failed: ${(error as Error).message}`);
    }
  }, [project]);

  const onFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const raw = await file.text();
        const parsed = parseProject(JSON.parse(raw) as unknown);
        loadProject(normalizeLoadedProject(parsed));
      } catch (error) {
        window.alert(`Could not read project file: ${(error as Error).message}`);
      } finally {
        event.target.value = "";
      }
    },
    [loadProject],
  );

  return (
    <div className="app-shell">
      <Toolbar
        activeTool={activeTool}
        activeLayer={activeLayer}
        fogBrushLevel={fogBrushLevel}
        canUndo={historyPastLength > 0}
        canRedo={historyFutureLength > 0}
        onSetTool={(tool) => {
          setTool(tool);
          if (tool === "fog") {
            setLayer("fog");
          }
        }}
        onSetLayer={setLayer}
        onSetFog={setFogBrushLevel}
        onUndo={undo}
        onRedo={redo}
        onNewProject={onNewProject}
        onLoadProject={onLoadProject}
        onSaveProject={onSaveProject}
        onExportPng={onExportPng}
      />

      <main className="workspace">
        <PalettePanel
          items={filteredItems}
          categories={categories}
          selectedCategory={selectedCategory}
          selectedTileId={selectedTileId}
          onPickTile={onPickTile}
          searchQuery={searchQuery}
          onSearchQuery={setSearchQuery}
          onCategoryChange={setSelectedCategory}
        />

        <section className="map-pane">
          <div className="map-pane-head">
            <h1>{project.metadata.name}</h1>
            <p>
              {selectionSummary(useEditorStore.getState())} · {canPaint(useEditorStore.getState()) ? "Ready" : "Pick a tile"}
            </p>
          </div>

          <PixiMapCanvas
            key={project.metadata.createdAt}
            calibration={project.calibration}
            bounds={project.metadata.maxBounds}
            cells={project.cells}
            selection={selection}
            lineStart={lineStart}
            activeTool={activeTool}
            assetsById={manifestById}
            onHover={setHoverCoord}
            onPrimaryAction={onPrimaryAction}
            onDragAction={onDragAction}
            onStrokeStart={onStrokeStart}
            onStrokeEnd={onStrokeEnd}
          />
        </section>

        <InspectorPanel
          selectedKey={selectedKey}
          selectedCount={selection.length}
          selectedCell={selectedCell}
          onSetLabel={setSelectedCellLabel}
          onSetNotes={setSelectedCellNotes}
          onSetFog={setSelectedCellFog}
          onRemoveLabel={removeSelectedCellLabel}
          onMoveSelection={moveSelection}
          calibration={project.calibration}
          onCalibrationChange={(next) => updateCalibration(() => next)}
          bounds={project.metadata.maxBounds}
          onBoundsChange={setBounds}
        />
      </main>

      <StatusBar
        activeTool={activeTool}
        activeLayer={activeLayer}
        selectionCount={selection.length}
        statusMessage={statusMessage}
        selectedTileName={selectedTileName}
      />

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json,.hexamap.json"
        onChange={onFileSelected}
      />
    </div>
  );
}
