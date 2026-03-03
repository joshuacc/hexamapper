# Hexamapper Workbench

Hexamapper Workbench is a browser-based hexcrawl map editor built for the VTT tile packs in `assets/`.
It is designed for fast map painting, layered composition, and clean export while preserving hex art that overhangs its tile boundaries.

## What It Does

- Paints hex maps with `base`, `overlay`, `marker`, and `fog` layers
- Supports `brush`, `erase`, `fill`, `line`, `select`, and `label/fog` workflows
- Renders in PixiJS with row-aware depth sorting (lower map rows draw on top)
- Exports flattened PNG maps
- Saves/loads `.hexamap.json` project files
- Keeps local autosave state in `localStorage`

## Stack

- React 19 + TypeScript
- Zustand + Immer for editor state/history
- PixiJS 8 for map rendering
- Vite for local dev/build
- Vitest + Playwright (smoke)

## Quick Start

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## NPM Scripts

- `npm run dev` starts the Vite dev server (auto-generates asset manifest first)
- `npm run build` type-checks and builds production output (also regenerates manifest)
- `npm run preview` serves the production build locally
- `npm run lint` runs ESLint
- `npm run test` runs Vitest
- `npm run test:e2e` runs the Playwright smoke test
- `npm run generate:manifest` rebuilds `src/data/assetManifest.generated.ts`

## Editor Controls

### Tools

- `B` brush
- `E` erase
- `F` fill
- `V` select
- `L` label tool
- `G` fog tool

### History

- `Ctrl/Cmd + Z` undo
- `Ctrl/Cmd + Shift + Z` redo

### Camera

- `Space + drag` pan
- `Middle click drag` pan
- `Right click drag` pan
- `Mouse wheel` zoom

## Map Model and Bounds

Hexes are stored as axial coordinates (`q,r`), but map bounds are interpreted as a **rectangular offset-row footprint**.

Why this matters:

- The map shape appears as a rectangle instead of a visual parallelogram
- Bounds checks use an offset-row transform
- Iteration across bounds uses offset rows and converts back to axial coordinates

Relevant implementation lives in:

- `src/domain/hexMath.ts` (`isWithinBounds`, `iterateBounds`, `boundsPixelEnvelope`)

## Depth Sorting and Overhang Art

Many assets extend outside the strict hex area (especially upward). To preserve depth cues, draw order is row-aware:

- Lower on-screen rows render above higher rows
- Layer priority (`base` -> `overlay` -> `marker` -> labels) is included in z-index tie-breaking

Relevant implementation:

- `src/renderer/PixiMapCanvas.tsx`
- `src/lib/exportPng.ts`

## Asset Pipeline

The app reads PNGs from the base and extended VTT packs and generates a typed manifest:

- Source script: `scripts/generate-asset-manifest.mjs`
- Generated file: `src/data/assetManifest.generated.ts`

Do not hand-edit generated manifest output.

## Project File Format

Projects are saved as `.hexamap.json` and include:

- `version`
- `metadata` (name, timestamps, bounds)
- `calibration` (hex size, origin, frame, sprite anchor, nudge)
- `cells` keyed as `"q,r"`

Validation/normalization is handled by `src/domain/projectSchema.ts`.

## Testing

```bash
npm run lint
npm run test
npm run build
```

Optional smoke test:

```bash
npm run test:e2e
```

Note: Playwright may require browser installation in a fresh environment.

## Troubleshooting

### Hover/paint feels wrong or stale after major coordinate changes

Clear autosave and reload:

```js
localStorage.removeItem("hexamapper.autosave.v1")
```

### New assets are missing in the palette

Rebuild the manifest:

```bash
npm run generate:manifest
```

### Build warns about large chunks

This is expected right now because Pixi and asset-heavy flows are bundled together.

## Repository Notes

- `assets/` is intentionally large and included in the repo
- Debug screenshots and Playwright artifacts are ignored by `.gitignore`
- Windows `:Zone.Identifier` sidecar files are ignored by `.gitignore`
