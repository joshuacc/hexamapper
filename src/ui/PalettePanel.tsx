import type { AssetManifestItem } from "../domain/types";

type PalettePanelProps = {
  items: AssetManifestItem[];
  categories: string[];
  selectedCategory: string | "All";
  selectedTileId: string | null;
  onPickTile: (tileId: string) => void;
  searchQuery: string;
  onSearchQuery: (query: string) => void;
  onCategoryChange: (category: string | "All") => void;
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

export function PalettePanel(props: PalettePanelProps) {
  const {
    items,
    categories,
    selectedCategory,
    selectedTileId,
    onPickTile,
    searchQuery,
    onSearchQuery,
    onCategoryChange,
  } = props;

  return (
    <aside className="panel palette-panel">
      <div className="panel-head">
        <h2>Tile Library</h2>
        <p>{items.length} tiles</p>
      </div>

      <input
        className="search-input"
        type="search"
        placeholder="Search terrain, river, urban..."
        value={searchQuery}
        onChange={(event) => onSearchQuery(event.target.value)}
      />

      <div className="category-strip">
        <button
          type="button"
          className={selectedCategory === "All" ? "chip-btn active" : "chip-btn"}
          onClick={() => onCategoryChange("All")}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={selectedCategory === category ? "chip-btn active" : "chip-btn"}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="tile-list" role="listbox" aria-label="Tile palette">
        {items.map((item) => (
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
              <span>{item.category}</span>
            </div>
            <span className={`layer-pill layer-pill--${item.inferredLayer}`}>{layerBadge(item.inferredLayer)}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
