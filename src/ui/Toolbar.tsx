import type { EditorLayer, EditorTool, FogLevel } from "../domain/types";

const TOOL_OPTIONS: Array<{ tool: EditorTool; label: string; shortcut: string }> = [
  { tool: "brush", label: "Brush", shortcut: "B" },
  { tool: "erase", label: "Erase", shortcut: "E" },
  { tool: "fill", label: "Fill", shortcut: "F" },
  { tool: "line", label: "Line", shortcut: "Shift+L" },
  { tool: "select", label: "Select", shortcut: "V" },
  { tool: "label", label: "Label", shortcut: "L" },
  { tool: "fog", label: "Fog", shortcut: "G" },
];

const LAYER_OPTIONS: Array<{ layer: EditorLayer; label: string }> = [
  { layer: "base", label: "Base" },
  { layer: "overlay", label: "Overlay" },
  { layer: "marker", label: "Marker" },
  { layer: "fog", label: "Fog" },
];

type ToolbarProps = {
  activeTool: EditorTool;
  activeLayer: EditorLayer;
  fogBrushLevel: FogLevel;
  canUndo: boolean;
  canRedo: boolean;
  onSetTool: (tool: EditorTool) => void;
  onSetLayer: (layer: EditorLayer) => void;
  onSetFog: (level: FogLevel) => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewProject: () => void;
  onLoadProject: () => void;
  onSaveProject: () => void;
  onExportPng: () => void;
};

export function Toolbar(props: ToolbarProps) {
  const {
    activeTool,
    activeLayer,
    fogBrushLevel,
    canUndo,
    canRedo,
    onSetTool,
    onSetLayer,
    onSetFog,
    onUndo,
    onRedo,
    onNewProject,
    onLoadProject,
    onSaveProject,
    onExportPng,
  } = props;

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        {TOOL_OPTIONS.map((option) => (
          <button
            key={option.tool}
            type="button"
            className={option.tool === activeTool ? "tool-btn active" : "tool-btn"}
            onClick={() => onSetTool(option.tool)}
            title={`${option.label} (${option.shortcut})`}
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-group">
        {LAYER_OPTIONS.map((option) => (
          <button
            key={option.layer}
            type="button"
            className={option.layer === activeLayer ? "chip-btn active" : "chip-btn"}
            onClick={() => onSetLayer(option.layer)}
          >
            {option.label}
          </button>
        ))}
        {activeLayer === "fog" ? (
          <select
            className="fog-select"
            value={fogBrushLevel}
            onChange={(event) => onSetFog(event.target.value as FogLevel)}
          >
            <option value="light">Light Fog</option>
            <option value="full">Full Fog</option>
            <option value="none">Clear Fog</option>
          </select>
        ) : null}
      </div>

      <div className="toolbar-group toolbar-group--right">
        <button type="button" className="small-btn" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className="small-btn" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
        <button type="button" className="small-btn" onClick={onNewProject}>
          New
        </button>
        <button type="button" className="small-btn" onClick={onLoadProject}>
          Load
        </button>
        <button type="button" className="small-btn" onClick={onSaveProject}>
          Save JSON
        </button>
        <button type="button" className="small-btn" onClick={onExportPng}>
          Export PNG
        </button>
      </div>
    </header>
  );
}
