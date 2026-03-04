import { beforeEach, describe, expect, it } from "vitest";
import { normalizeLoadedProject, useEditorStore } from "../editorStore";

describe("editorStore", () => {
  beforeEach(() => {
    useEditorStore.getState().newProject("Test", { minQ: 0, maxQ: 6, minR: 0, maxR: 6 });
    useEditorStore.getState().setLayer("base");
    useEditorStore.getState().setSelectedTile("base:tile");
    useEditorStore.setState({ historyPast: [], historyFuture: [] });
  });

  it("seeds new maps with blank base terrain", () => {
    const project = useEditorStore.getState().project;
    expect(project.cells["0,0"]?.baseTileId).toBe("base:hex-base-blank");
    expect(project.cells["6,3"]?.baseTileId).toBe("base:hex-base-blank");
  });

  it("paints and erases with undo/redo", () => {
    const store = useEditorStore.getState();
    store.paintAt({ q: 1, r: 1 });
    expect(useEditorStore.getState().project.cells["1,1"]?.baseTileId).toBe("base:tile");

    store.undo();
    expect(useEditorStore.getState().project.cells["1,1"]?.baseTileId).toBe("base:hex-base-blank");

    store.redo();
    expect(useEditorStore.getState().project.cells["1,1"]?.baseTileId).toBe("base:tile");

    store.eraseAt({ q: 1, r: 1 });
    expect(useEditorStore.getState().project.cells["1,1"]).toBeUndefined();
  });

  it("fills contiguous regions", () => {
    const store = useEditorStore.getState();
    store.paintAt({ q: 0, r: 0 });
    store.paintAt({ q: 0, r: 1 });

    store.setSelectedTile("base:other");
    store.fillFrom({ q: 0, r: 0 });

    expect(useEditorStore.getState().project.cells["0,0"]?.baseTileId).toBe("base:other");
    expect(useEditorStore.getState().project.cells["0,1"]?.baseTileId).toBe("base:other");
  });

  it("replaces overlay tile on brush paint instead of stacking", () => {
    const store = useEditorStore.getState();
    store.setLayer("overlay");
    store.setSelectedTile("overlay:tile-a");
    store.paintAt({ q: 2, r: 2 });

    store.setSelectedTile("overlay:tile-b");
    store.paintAt({ q: 2, r: 2 });

    expect(useEditorStore.getState().project.cells["2,2"]?.overlayTileIds).toEqual(["overlay:tile-b"]);
  });

  it("clears overlays when painting base terrain", () => {
    const store = useEditorStore.getState();
    store.setLayer("overlay");
    store.setSelectedTile("overlay:tile-a");
    store.paintAt({ q: 3, r: 3 });

    store.setLayer("base");
    store.setSelectedTile("base:tile");
    store.paintAt({ q: 3, r: 3 });

    const cell = useEditorStore.getState().project.cells["3,3"];
    expect(cell?.baseTileId).toBe("base:tile");
    expect(cell?.overlayTileIds).toEqual([]);
  });

  it("migrates legacy rectangular coordinates on load", () => {
    const now = new Date().toISOString();
    const project = normalizeLoadedProject({
      version: 1,
      metadata: {
        name: "Legacy",
        createdAt: now,
        updatedAt: now,
        tileSet: "vtt-72",
        coordinateSystem: "axial",
        maxBounds: { minQ: 0, maxQ: 10, minR: 0, maxR: 8 },
      },
      calibration: useEditorStore.getState().project.calibration,
      cells: Object.fromEntries(
        Array.from({ length: 10 }, (_, q) => [
          `${q},8`,
          {
            baseTileId: "base:tile",
            overlayTileIds: [],
            markerTileIds: [],
            fog: "none" as const,
          },
        ]),
      ),
    });

    expect(project.cells["8,4"]?.baseTileId).toBe("base:tile");
    expect(project.cells["8,8"]).toBeUndefined();
  });
});
