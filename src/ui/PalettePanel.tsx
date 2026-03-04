import { useMemo, useState } from "react";
import { deriveTileHierarchy, type TileHierarchy } from "../data/manifest";
import type { AssetManifestItem } from "../domain/types";

type PalettePanelProps = {
  items: AssetManifestItem[];
  selectedTileId: string | null;
  onPickTile: (tileId: string) => void;
  searchQuery: string;
  onSearchQuery: (query: string) => void;
};

function layerBadge(layer: AssetManifestItem["inferredLayer"]): string {
  if (layer === "base") {
    return "BASE";
  }
  if (layer === "overlay") {
    return "OVERLAY";
  }
  return "MARKER";
}

const ALL_THEMES = "All Themes";
const ALL_FAMILIES = "All Families";
const ALL_TYPES = "All Types";
const ALL_DETAILS = "All Details";

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function hierarchyPath(hierarchy: TileHierarchy): string {
  const parts = [hierarchy.theme, hierarchy.family, hierarchy.type];
  if (hierarchy.detail !== "General") {
    parts.push(hierarchy.detail);
  }
  return parts.join(" > ");
}

export function PalettePanel(props: PalettePanelProps) {
  const { items, selectedTileId, onPickTile, searchQuery, onSearchQuery } = props;
  const [selectedTheme, setSelectedTheme] = useState<string>(ALL_THEMES);
  const [selectedFamily, setSelectedFamily] = useState<string>(ALL_FAMILIES);
  const [selectedType, setSelectedType] = useState<string>(ALL_TYPES);
  const [selectedDetail, setSelectedDetail] = useState<string>(ALL_DETAILS);

  const entries = useMemo(
    () => items.map((item) => ({ item, hierarchy: deriveTileHierarchy(item) })),
    [items],
  );

  const themeOptions = useMemo(
    () => uniqueSorted(entries.map((entry) => entry.hierarchy.theme)),
    [entries],
  );
  const effectiveTheme =
    selectedTheme === ALL_THEMES || themeOptions.includes(selectedTheme)
      ? selectedTheme
      : ALL_THEMES;

  const entriesByTheme = useMemo(
    () =>
      effectiveTheme === ALL_THEMES
        ? entries
        : entries.filter((entry) => entry.hierarchy.theme === effectiveTheme),
    [effectiveTheme, entries],
  );

  const familyOptions = useMemo(
    () => uniqueSorted(entriesByTheme.map((entry) => entry.hierarchy.family)),
    [entriesByTheme],
  );
  const effectiveFamily =
    selectedFamily === ALL_FAMILIES || familyOptions.includes(selectedFamily)
      ? selectedFamily
      : ALL_FAMILIES;

  const entriesByFamily = useMemo(
    () =>
      effectiveFamily === ALL_FAMILIES
        ? entriesByTheme
        : entriesByTheme.filter((entry) => entry.hierarchy.family === effectiveFamily),
    [effectiveFamily, entriesByTheme],
  );

  const typeOptions = useMemo(
    () => uniqueSorted(entriesByFamily.map((entry) => entry.hierarchy.type)),
    [entriesByFamily],
  );
  const effectiveType =
    selectedType === ALL_TYPES || typeOptions.includes(selectedType)
      ? selectedType
      : ALL_TYPES;

  const entriesByType = useMemo(
    () =>
      effectiveType === ALL_TYPES
        ? entriesByFamily
        : entriesByFamily.filter((entry) => entry.hierarchy.type === effectiveType),
    [effectiveType, entriesByFamily],
  );

  const detailOptions = useMemo(
    () => uniqueSorted(entriesByType.map((entry) => entry.hierarchy.detail)),
    [entriesByType],
  );
  const effectiveDetail =
    selectedDetail === ALL_DETAILS || detailOptions.includes(selectedDetail)
      ? selectedDetail
      : ALL_DETAILS;

  const visibleEntries = useMemo(
    () =>
      effectiveDetail === ALL_DETAILS
        ? entriesByType
        : entriesByType.filter((entry) => entry.hierarchy.detail === effectiveDetail),
    [effectiveDetail, entriesByType],
  );

  const activePath = useMemo(() => {
    const parts = [
      effectiveTheme !== ALL_THEMES ? effectiveTheme : null,
      effectiveFamily !== ALL_FAMILIES ? effectiveFamily : null,
      effectiveType !== ALL_TYPES ? effectiveType : null,
      effectiveDetail !== ALL_DETAILS ? effectiveDetail : null,
    ].filter((value): value is string => Boolean(value));
    return parts.length > 0 ? parts.join(" > ") : "All Tiles";
  }, [effectiveDetail, effectiveFamily, effectiveTheme, effectiveType]);

  return (
    <aside className="panel palette-panel">
      <div className="panel-head">
        <h2>Tile Library</h2>
        <p>
          {visibleEntries.length} of {items.length} tiles
        </p>
      </div>

      <input
        className="search-input"
        type="search"
        placeholder="Search terrain, river, urban..."
        value={searchQuery}
        onChange={(event) => onSearchQuery(event.target.value)}
      />

      <div className="hierarchy-controls">
        <div className="hierarchy-row">
          <label className="hierarchy-field">
            <span>Theme</span>
            <select
              className="hierarchy-select"
              value={effectiveTheme}
              onChange={(event) => {
                setSelectedTheme(event.target.value);
                setSelectedFamily(ALL_FAMILIES);
                setSelectedType(ALL_TYPES);
                setSelectedDetail(ALL_DETAILS);
              }}
            >
              <option value={ALL_THEMES}>{ALL_THEMES}</option>
              {themeOptions.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
          </label>
          <label className="hierarchy-field">
            <span>Family</span>
            <select
              className="hierarchy-select"
              value={effectiveFamily}
              onChange={(event) => {
                setSelectedFamily(event.target.value);
                setSelectedType(ALL_TYPES);
                setSelectedDetail(ALL_DETAILS);
              }}
            >
              <option value={ALL_FAMILIES}>{ALL_FAMILIES}</option>
              {familyOptions.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="hierarchy-row">
          <label className="hierarchy-field">
            <span>Type</span>
            <select
              className="hierarchy-select"
              value={effectiveType}
              onChange={(event) => {
                setSelectedType(event.target.value);
                setSelectedDetail(ALL_DETAILS);
              }}
            >
              <option value={ALL_TYPES}>{ALL_TYPES}</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="hierarchy-field">
            <span>Detail</span>
            <select
              className="hierarchy-select"
              value={effectiveDetail}
              onChange={(event) => setSelectedDetail(event.target.value)}
            >
              <option value={ALL_DETAILS}>{ALL_DETAILS}</option>
              {detailOptions.map((detail) => (
                <option key={detail} value={detail}>
                  {detail}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="hierarchy-breadcrumb">{activePath}</p>
      </div>

      <div className="tile-list" role="listbox" aria-label="Tile palette">
        {visibleEntries.map(({ item, hierarchy }) => (
          <button
            key={item.id}
            type="button"
            className={item.id === selectedTileId ? "tile-card active" : "tile-card"}
            onClick={() => onPickTile(item.id)}
            title={item.name}
          >
            <img src={item.path} alt={item.name} loading="lazy" />
            <div className="tile-card-meta">
              <strong>{item.name}</strong>
              <span>{hierarchyPath(hierarchy)}</span>
            </div>
            <span className={`layer-pill layer-pill--${item.inferredLayer}`}>{layerBadge(item.inferredLayer)}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
