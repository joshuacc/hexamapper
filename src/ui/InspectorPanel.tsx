import { useMemo } from "react";
import type { FogLevel, GridCalibration, HexLayerSet, MapBounds } from "../domain/types";
import { MOVE_DIRECTIONS } from "../state/editorStore";

type InspectorPanelProps = {
  selectedKey: string | null;
  selectedCount: number;
  selectedCell: HexLayerSet | null;
  onSetLabel: (label: string) => void;
  onSetNotes: (notes: string) => void;
  onSetFog: (fog: FogLevel) => void;
  onRemoveLabel: () => void;
  onMoveSelection: (delta: readonly [number, number]) => void;
  calibration: GridCalibration;
  onCalibrationChange: (calibration: GridCalibration) => void;
  bounds: MapBounds;
  onBoundsChange: (bounds: MapBounds) => void;
};

function parseInteger(input: string, fallback: number): number {
  const value = Number.parseInt(input, 10);
  return Number.isFinite(value) ? value : fallback;
}

export function InspectorPanel(props: InspectorPanelProps) {
  const {
    selectedKey,
    selectedCount,
    selectedCell,
    onSetLabel,
    onSetNotes,
    onSetFog,
    onRemoveLabel,
    onMoveSelection,
    calibration,
    onCalibrationChange,
    bounds,
    onBoundsChange,
  } = props;

  const selectedSummary = useMemo(() => {
    if (selectedCount === 0) {
      return "No hex selected";
    }
    if (selectedCount === 1) {
      return selectedKey ?? "Selected hex";
    }
    return `${selectedCount} hexes selected`;
  }, [selectedCount, selectedKey]);

  return (
    <aside className="panel inspector-panel">
      <div className="panel-head">
        <h2>Inspector</h2>
        <p>{selectedSummary}</p>
      </div>

      {selectedCell ? (
        <>
          <section className="inspector-section">
            <h3>Layer Stack</h3>
            <div className="stack-line">
              <span>Base</span>
              <code>{selectedCell.baseTileId ?? "(empty)"}</code>
            </div>
            <div className="stack-line">
              <span>Overlay</span>
              <code>{selectedCell.overlayTileIds.join(", ") || "(none)"}</code>
            </div>
            <div className="stack-line">
              <span>Marker</span>
              <code>{selectedCell.markerTileIds.join(", ") || "(none)"}</code>
            </div>
            <div className="stack-line">
              <span>Fog</span>
              <select
                value={selectedCell.fog}
                onChange={(event) => onSetFog(event.target.value as FogLevel)}
              >
                <option value="none">None</option>
                <option value="light">Light</option>
                <option value="full">Full</option>
              </select>
            </div>
          </section>

          <section className="inspector-section">
            <h3>Label</h3>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. Black Tooth Keep"
              value={selectedCell.label?.text ?? ""}
              onChange={(event) => onSetLabel(event.target.value)}
            />
            <button type="button" className="small-btn" onClick={onRemoveLabel}>
              Clear Label
            </button>
          </section>

          <section className="inspector-section">
            <h3>Notes</h3>
            <textarea
              className="text-area"
              placeholder="Encounter notes, lore, travel hazards..."
              value={selectedCell.notes ?? ""}
              onChange={(event) => onSetNotes(event.target.value)}
            />
          </section>
        </>
      ) : null}

      <section className="inspector-section">
        <h3>Move Selection</h3>
        <div className="move-grid">
          {MOVE_DIRECTIONS.map((direction) => (
            <button
              key={direction.name}
              type="button"
              className="small-btn"
              onClick={() => onMoveSelection(direction.delta)}
              disabled={selectedCount === 0}
            >
              {direction.name}
            </button>
          ))}
        </div>
      </section>

      <section className="inspector-section">
        <h3>Map Bounds</h3>
        <div className="mini-grid">
          <label>
            Min Q
            <input
              className="text-input"
              type="number"
              value={bounds.minQ}
              onChange={(event) =>
                onBoundsChange({ ...bounds, minQ: parseInteger(event.target.value, bounds.minQ) })
              }
            />
          </label>
          <label>
            Max Q
            <input
              className="text-input"
              type="number"
              value={bounds.maxQ}
              onChange={(event) =>
                onBoundsChange({ ...bounds, maxQ: parseInteger(event.target.value, bounds.maxQ) })
              }
            />
          </label>
          <label>
            Min R
            <input
              className="text-input"
              type="number"
              value={bounds.minR}
              onChange={(event) =>
                onBoundsChange({ ...bounds, minR: parseInteger(event.target.value, bounds.minR) })
              }
            />
          </label>
          <label>
            Max R
            <input
              className="text-input"
              type="number"
              value={bounds.maxR}
              onChange={(event) =>
                onBoundsChange({ ...bounds, maxR: parseInteger(event.target.value, bounds.maxR) })
              }
            />
          </label>
        </div>
      </section>

      <section className="inspector-section">
        <h3>Grid Calibration</h3>
        <div className="mini-grid">
          <label>
            Hex Size
            <input
              className="text-input"
              type="number"
              value={calibration.hexSizePx}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  hexSizePx: parseInteger(event.target.value, calibration.hexSizePx),
                })
              }
            />
          </label>
          <label>
            Origin X
            <input
              className="text-input"
              type="number"
              value={calibration.originPx.x}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  originPx: {
                    ...calibration.originPx,
                    x: parseInteger(event.target.value, calibration.originPx.x),
                  },
                })
              }
            />
          </label>
          <label>
            Origin Y
            <input
              className="text-input"
              type="number"
              value={calibration.originPx.y}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  originPx: {
                    ...calibration.originPx,
                    y: parseInteger(event.target.value, calibration.originPx.y),
                  },
                })
              }
            />
          </label>
          <label>
            Anchor X
            <input
              className="text-input"
              type="number"
              value={calibration.spriteAnchorPx.x}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  spriteAnchorPx: {
                    ...calibration.spriteAnchorPx,
                    x: parseInteger(event.target.value, calibration.spriteAnchorPx.x),
                  },
                })
              }
            />
          </label>
          <label>
            Anchor Y
            <input
              className="text-input"
              type="number"
              value={calibration.spriteAnchorPx.y}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  spriteAnchorPx: {
                    ...calibration.spriteAnchorPx,
                    y: parseInteger(event.target.value, calibration.spriteAnchorPx.y),
                  },
                })
              }
            />
          </label>
          <label>
            Nudge X
            <input
              className="text-input"
              type="number"
              value={calibration.manualNudgePx.x}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  manualNudgePx: {
                    ...calibration.manualNudgePx,
                    x: parseInteger(event.target.value, calibration.manualNudgePx.x),
                  },
                })
              }
            />
          </label>
          <label>
            Nudge Y
            <input
              className="text-input"
              type="number"
              value={calibration.manualNudgePx.y}
              onChange={(event) =>
                onCalibrationChange({
                  ...calibration,
                  manualNudgePx: {
                    ...calibration.manualNudgePx,
                    y: parseInteger(event.target.value, calibration.manualNudgePx.y),
                  },
                })
              }
            />
          </label>
        </div>
      </section>
    </aside>
  );
}
