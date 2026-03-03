# AGENTS.md

Guidance for coding agents working in this repository.

## Purpose

This repo is a hexcrawl map editor focused on fast authoring and correct hex rendering behavior for overhanging art assets.

Primary goals:

- Keep painting interactions responsive
- Preserve rectangular map footprint behavior
- Preserve depth sorting behavior for tall/overhanging sprites
- Avoid regressions in project save/load and export

## Local Setup

```bash
npm install
npm run dev
```

Useful checks before finishing work:

```bash
npm run lint
npm run test
npm run build
```

## High-Level Architecture

- `src/App.tsx` top-level shell and tool wiring
- `src/state/editorStore.ts` editor state, mutations, history, selection, fill/line logic
- `src/renderer/PixiMapCanvas.tsx` Pixi canvas, input handling, camera, rendering
- `src/domain/hexMath.ts` coordinate math, bounds logic, iteration/envelope helpers
- `src/domain/projectSchema.ts` project schema parsing/normalization
- `src/lib/exportPng.ts` flattened export renderer
- `scripts/generate-asset-manifest.mjs` asset discovery and manifest generation
- `src/data/assetManifest.generated.ts` generated asset manifest (do not hand-edit)

## Coordinate and Bounds Gotchas

Bounds are not a raw axial rectangle.

- `MapBounds` values are interpreted as a rectangular offset-row footprint
- `isWithinBounds` converts axial `q,r` to offset row for bounds checks
- `iterateBounds` iterates row/column bounds then converts back to axial

If you change one of these, update all related helpers and tests together:

- `isWithinBounds`
- `iterateBounds`
- `boundsPixelEnvelope`
- tests in `src/domain/__tests__/hexMath.test.ts`

## Rendering and Interaction Gotchas

- Depth sorting must remain row-aware so lower rows render above higher ones
- Pointer mapping should use canvas pixel size vs. DOM rect size to avoid DPI hit-test drift
- Hover updates should avoid unnecessary full-app rerenders
- Keep map redraw effects separated from fast overlay/hover effects when possible

If interaction seems broken after changes, verify:

- hover coordinates update across the whole canvas
- brush and fill both mutate state (`status-note` and `project.cells`)
- rectangular bounds still behave as expected

## State and History Rules

- Use store actions in `editorStore` instead of ad-hoc state mutations
- Preserve undo/redo behavior when adding tools or mutations
- For stroke-like tools, keep `beginStroke`/`commitStroke` flow intact
- Avoid introducing expensive work into hot pointer-move paths

## Asset and Manifest Rules

- Manifest is generated from PNG files in:
  - `assets/World Map Hex Tiles Pack/Assets - 72 DPI (VTT)`
  - `assets/World Map Hex Tiles Pack/Assets - Extended -72 DPI (VTT)`
- If assets are added/renamed, run `npm run generate:manifest`
- Ignore or remove `*:Zone.Identifier` files; they are Windows metadata sidecars

## Testing Expectations

Minimum for most changes:

- `npm run lint`
- `npm run test`

For renderer/input/camera/bounds changes, also run:

- `npm run build`
- `npm run test:e2e` when possible

## Documentation Expectations

When behavior changes, update:

- `README.md` for user-facing workflow/controls/format changes
- tests and inline comments for non-obvious math/rendering behavior

## Safe Contribution Pattern

1. Read relevant files first (`hexMath`, `editorStore`, `PixiMapCanvas`)
2. Implement the smallest coherent change
3. Add or update tests
4. Run lint/test/build
5. Summarize what changed and why, including tradeoffs/assumptions
