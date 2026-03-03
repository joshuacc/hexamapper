import type { EditorLayer, EditorTool } from "../domain/types";
import { useEditorStore } from "../state/editorStore";

type StatusBarProps = {
  activeTool: EditorTool;
  activeLayer: EditorLayer;
  selectionCount: number;
  statusMessage: string;
  selectedTileName: string;
};

export function StatusBar(props: StatusBarProps) {
  const { activeTool, activeLayer, selectionCount, statusMessage, selectedTileName } = props;
  const hoverCoord = useEditorStore((state) => state.hoverCoord);

  return (
    <footer className="status-bar">
      <span>
        <strong>Tool:</strong> {activeTool}
      </span>
      <span>
        <strong>Layer:</strong> {activeLayer}
      </span>
      <span>
        <strong>Hover:</strong> {hoverCoord ? `${hoverCoord.q}, ${hoverCoord.r}` : "-"}
      </span>
      <span>
        <strong>Selection:</strong> {selectionCount}
      </span>
      <span>
        <strong>Tile:</strong> {selectedTileName}
      </span>
      <span className="status-note">{statusMessage}</span>
    </footer>
  );
}
