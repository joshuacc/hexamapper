# Hexamapper Workbench

Hexamapper Workbench is a browser-based hexcrawl map editor tuned for the dropped 72 DPI VTT tile packs in `assets/`.

## Features in this build

- WebGL canvas rendering with PixiJS
- Axial coordinate map model (`q,r`)
- Layered per-hex editing: `base`, `overlay`, `marker`, and fog
- Brush, erase, fill, line, select, label, and fog tools
- Undo/redo history
- Multi-hex selection with directional move controls
- Grid calibration controls (size/origin/anchor/nudge)
- Project save/load as JSON
- Flattened PNG export with row-based depth sorting for overflow art
- Local autosave restore

## Quick start

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Key controls

- `B`: Brush
- `E`: Erase
- `F`: Fill
- `V`: Select
- `L`: Label tool
- `G`: Fog tool
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z`: Redo
- `Space + drag` or `middle/right mouse drag`: Pan
- Mouse wheel: Zoom

## Project format

Saved projects are JSON (`*.hexamap.json`) with:

- `version`
- `metadata` (name, bounds, timestamps)
- `calibration` (hex geometry + sprite anchoring)
- `cells` keyed as `"q,r"`

## Tests

```bash
npm run test
```

Optional e2e smoke test:

```bash
npm run test:e2e
```

(Playwright browser binaries may need installation in a fresh environment.)
