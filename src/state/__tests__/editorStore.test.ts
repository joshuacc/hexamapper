import { beforeEach, describe, expect, it } from "vitest";
import { normalizeLoadedProject, useEditorStore } from "../editorStore";

describe("editorStore", () => {
  beforeEach(() => {
    useEditorStore.getState().newProject("Test", { minQ: 0, maxQ: 6, minR: 0, maxR: 6 });
    useEditorStore.getState().setLayer("base");
    useEditorStore.getState().setSelectedTile("base:tile");
    useEditorStore.setState({ historyPast: [], historyFuture: [] });
  });

  it("paints and erases with undo/redo", () => {
    const store = useEditorStore.getState();
    store.paintAt({ q: 1, r: 1 });
    expect(useEditorStore.getState().project.cells["1,1"]?.baseTileId).toBe("base:tile");

    store.undo();
    expect(useEditorStore.getState().project.cells["1,1"]).toBeUndefined();

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
