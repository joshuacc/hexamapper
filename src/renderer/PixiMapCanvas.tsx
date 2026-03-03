import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import {
  axialKey,
  axialToPixel,
  boundsPixelEnvelope,
  isWithinBounds,
  offsetRowForAxial,
  parseAxialKey,
  pixelToAxial,
} from "../domain/hexMath";
import { createTrimmedTerrainCanvas } from "../lib/terrainTrim";
import type {
  AxialCoord,
  GridCalibration,
  HexLayerSet,
  MapBounds,
  EditorTool,
  AssetManifestItem,
} from "../domain/types";

const Z_MULTIPLIER = 1000;
const COMFORT_ZOOM = 1.65;
const TERRAIN_TRIM_SIGNATURE = "column-profile-v3";

type PixiMapCanvasProps = {
  calibration: GridCalibration;
  bounds: MapBounds;
  cells: Record<string, HexLayerSet>;
  selection: string[];
  lineStart: AxialCoord | null;
  activeTool: EditorTool;
  assetsById: Map<string, AssetManifestItem>;
  onHover: (coord: AxialCoord | null) => void;
  onPrimaryAction: (coord: AxialCoord, shiftKey: boolean) => void;
  onDragAction: (coord: AxialCoord) => void;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
};

type CameraState = {
  x: number;
  y: number;
  scale: number;
};

function zIndexFor(point: { x: number; y: number }, layerPriority: number): number {
  const yKey = Math.floor(point.y * Z_MULTIPLIER);
  const xTie = Math.floor(point.x % 997);
  return yKey + layerPriority * 10 + xTie;
}

function hexPoints(center: { x: number; y: number }, size: number): number[] {
  const points: number[] = [];
  for (let corner = 0; corner < 6; corner += 1) {
    const angle = (Math.PI / 180) * (60 * corner);
    points.push(center.x + size * Math.cos(angle));
    points.push(center.y + size * Math.sin(angle));
  }
  return points;
}

function clearContainer(container: Container): void {
  const children = container.removeChildren();
  for (const child of children) {
    child.destroy();
  }
}

function shouldTrackStroke(tool: EditorTool): boolean {
  return tool === "brush" || tool === "erase" || tool === "fog";
}

function shouldTrimTerrainBottom(coord: AxialCoord, bounds: MapBounds): boolean {
  return offsetRowForAxial(coord) < bounds.maxR;
}

export function PixiMapCanvas(props: PixiMapCanvasProps) {
  const {
    calibration,
    bounds,
    cells,
    selection,
    lineStart,
    activeTool,
    assetsById,
    onHover,
    onPrimaryAction,
    onDragAction,
    onStrokeStart,
    onStrokeEnd,
  } = props;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const mapRef = useRef<Container | null>(null);
  const fogRef = useRef<Graphics | null>(null);
  const gridRef = useRef<Graphics | null>(null);
  const selectionRef = useRef<Graphics | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [localHoverCoord, setLocalHoverCoord] = useState<AxialCoord | null>(null);

  const cameraRef = useRef<CameraState>({ x: 0, y: 0, scale: 1 });
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const isPaintingRef = useRef(false);
  const lastPaintedKeyRef = useRef<string | null>(null);
  const lastHoverKeyRef = useRef<string | null>(null);
  const spaceDownRef = useRef(false);
  const hasUserMovedCameraRef = useRef(false);
  const loadedAssetPathsRef = useRef<Set<string>>(new Set());
  const pendingAssetLoadsRef = useRef<Map<string, Promise<void>>>(new Map());
  const trimmedTerrainTexturesRef = useRef<Map<string, Texture>>(new Map());
  const pendingTrimmedTerrainTexturesRef = useRef<Map<string, Promise<void>>>(new Map());
  const trimSignatureRef = useRef<string>("");

  const selectionSet = useMemo(() => new Set(selection), [selection]);

  useEffect(() => {
    let disposed = false;
    const trimmedTerrainTextures = trimmedTerrainTexturesRef.current;
    const pendingTrimmedTerrainTextures = pendingTrimmedTerrainTexturesRef.current;

    async function setup() {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const app = new Application();
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        resizeTo: root,
      });

      if (disposed) {
        app.destroy(true);
        return;
      }

      root.appendChild(app.canvas);

      const world = new Container();
      const mapLayer = new Container();
      mapLayer.sortableChildren = true;
      const overlayLayer = new Container();
      const fogLayer = new Graphics();
      const gridLayer = new Graphics();
      const selectionLayer = new Graphics();

      world.addChild(mapLayer);
      overlayLayer.addChild(fogLayer);
      overlayLayer.addChild(gridLayer);
      overlayLayer.addChild(selectionLayer);
      world.addChild(overlayLayer);
      app.stage.addChild(world);

      appRef.current = app;
      worldRef.current = world;
      mapRef.current = mapLayer;
      fogRef.current = fogLayer;
      gridRef.current = gridLayer;
      selectionRef.current = selectionLayer;
      setAppReady(true);

      world.position.set(cameraRef.current.x, cameraRef.current.y);
      world.scale.set(cameraRef.current.scale);
    }

    setup();

    return () => {
      disposed = true;
      if (appRef.current) {
        appRef.current.destroy(true, {
          children: true,
          texture: false,
          textureSource: false,
        });
      }
      appRef.current = null;
      worldRef.current = null;
      mapRef.current = null;
      fogRef.current = null;
      gridRef.current = null;
      selectionRef.current = null;
      lastHoverKeyRef.current = null;
      for (const texture of trimmedTerrainTextures.values()) {
        texture.destroy(true);
      }
      trimmedTerrainTextures.clear();
      pendingTrimmedTerrainTextures.clear();
      setLocalHoverCoord(null);
      setAppReady(false);
    };
  }, []);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const mapLayer = mapRef.current;
    const fogLayer = fogRef.current;

    if (!mapLayer || !fogLayer) {
      return;
    }

    const activeMapLayer = mapLayer;
    const activeFogLayer = fogLayer;
    let cancelled = false;

    if (trimSignatureRef.current !== TERRAIN_TRIM_SIGNATURE) {
      for (const texture of trimmedTerrainTexturesRef.current.values()) {
        texture.destroy(true);
      }
      trimmedTerrainTexturesRef.current.clear();
      pendingTrimmedTerrainTexturesRef.current.clear();
      trimSignatureRef.current = TERRAIN_TRIM_SIGNATURE;
    }

    async function ensureAsset(path: string): Promise<void> {
      if (loadedAssetPathsRef.current.has(path)) {
        return;
      }

      const pending = pendingAssetLoadsRef.current.get(path);
      if (pending) {
        await pending;
        return;
      }

      const loadPromise = Assets.load(path)
        .then(() => {
          loadedAssetPathsRef.current.add(path);
        })
        .catch(() => {
          // Ignore missing textures; missing assets are skipped at draw time.
        })
        .finally(() => {
          pendingAssetLoadsRef.current.delete(path);
        });

      pendingAssetLoadsRef.current.set(path, loadPromise);
      await loadPromise;
    }

    async function ensureTrimmedTerrainTexture(path: string): Promise<void> {
      if (trimmedTerrainTexturesRef.current.has(path)) {
        return;
      }

      const pending = pendingTrimmedTerrainTexturesRef.current.get(path);
      if (pending) {
        await pending;
        return;
      }

      const trimPromise = new Promise<void>((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          const width = image.naturalWidth || image.width;
          const height = image.naturalHeight || image.height;
          if (width <= 0 || height <= 0) {
            resolve();
            return;
          }

          const trimmedCanvas = createTrimmedTerrainCanvas(image);
          if (!trimmedCanvas) {
            resolve();
            return;
          }

          const texture = Texture.from(trimmedCanvas);
          trimmedTerrainTexturesRef.current.set(path, texture);
          resolve();
        };
        image.onerror = () => resolve();
        image.src = path;
      }).finally(() => {
        pendingTrimmedTerrainTexturesRef.current.delete(path);
      });

      pendingTrimmedTerrainTexturesRef.current.set(path, trimPromise);
      await trimPromise;
    }

    async function redrawMap(): Promise<void> {
      const requiredPaths = new Set<string>();
      const requiredTrimmedTerrainPaths = new Set<string>();

      function collectPath(tileId: string, trimTerrainBottom = false): void {
        const item = assetsById.get(tileId);
        if (!item) {
          return;
        }
        requiredPaths.add(item.path);
        if (trimTerrainBottom) {
          requiredTrimmedTerrainPaths.add(item.path);
        }
      }

      for (const [key, cell] of Object.entries(cells)) {
        const coord = parseAxialKey(key);
        if (cell.baseTileId) {
          collectPath(cell.baseTileId, shouldTrimTerrainBottom(coord, bounds));
        }
        cell.overlayTileIds.forEach((tileId) => collectPath(tileId));
        cell.markerTileIds.forEach((tileId) => collectPath(tileId));
      }

      await Promise.all([...requiredPaths].map((path) => ensureAsset(path)));
      await Promise.all(
        [...requiredTrimmedTerrainPaths].map((path) => ensureTrimmedTerrainTexture(path)),
      );
      if (cancelled) {
        return;
      }

      clearContainer(activeMapLayer);
      activeFogLayer.clear();

      const labelStyleSmall = new TextStyle({
        fontFamily: "Alegreya, serif",
        fontSize: 14,
        fill: "#f6f0d6",
        stroke: { color: "#1f1b14", width: 3 },
        fontWeight: "500",
      });

      const labelStyleTitle = new TextStyle({
        fontFamily: "Cinzel, serif",
        fontSize: 20,
        fill: "#fff6ce",
        stroke: { color: "#1e140d", width: 4 },
        fontWeight: "700",
        letterSpacing: 1,
      });

      const tileAnchorX = calibration.spriteAnchorPx.x / calibration.tileFramePx.w;
      const tileAnchorY = calibration.spriteAnchorPx.y / calibration.tileFramePx.h;

      function addTileSprite(
        tileId: string,
        center: { x: number; y: number },
        layerPriority: number,
        options?: { trimTerrainBottom?: boolean },
      ): void {
        const item = assetsById.get(tileId);
        if (!item) {
          return;
        }
        const texture =
          options?.trimTerrainBottom
            ? trimmedTerrainTexturesRef.current.get(item.path) ?? Texture.from(item.path)
            : Texture.from(item.path);
        const sprite = new Sprite(texture);
        sprite.anchor.set(tileAnchorX, tileAnchorY);
        sprite.position.set(center.x, center.y);
        sprite.zIndex = zIndexFor(center, layerPriority);
        activeMapLayer.addChild(sprite);
      }

      for (const [key, cell] of Object.entries(cells)) {
        const coord = parseAxialKey(key);
        const center = axialToPixel(coord, calibration);
        const trimTerrainBottom = shouldTrimTerrainBottom(coord, bounds);

        if (cell.baseTileId) {
          addTileSprite(cell.baseTileId, center, 0, { trimTerrainBottom });
        }

        cell.overlayTileIds.forEach((tileId, index) => {
          addTileSprite(tileId, center, 1 + index * 0.01);
        });

        cell.markerTileIds.forEach((tileId, index) => {
          addTileSprite(tileId, center, 2 + index * 0.01);
        });

        if (cell.fog !== "none") {
          const alpha = cell.fog === "full" ? 0.75 : 0.4;
          activeFogLayer.beginFill(0x1b1310, alpha);
          activeFogLayer.drawPolygon(hexPoints(center, calibration.hexSizePx));
          activeFogLayer.endFill();
        }

        if (cell.label?.text) {
          const label = new Text({
            text: cell.label.text,
            style: cell.label.style === "title" ? labelStyleTitle : labelStyleSmall,
          });
          label.anchor.set(0.5, 0.5);
          label.position.set(center.x + cell.label.offsetPx.x, center.y + cell.label.offsetPx.y);
          label.zIndex = zIndexFor(center, 4);
          activeMapLayer.addChild(label);
        }
      }
    }

    void redrawMap();
    return () => {
      cancelled = true;
    };
  }, [appReady, assetsById, bounds, calibration, cells]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const gridLayer = gridRef.current;
    if (!gridLayer) {
      return;
    }

    // Grid overlay intentionally disabled; terrain art already carries boundary cues.
    gridLayer.clear();
  }, [appReady, bounds, calibration]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const selectionLayer = selectionRef.current;
    if (!selectionLayer) {
      return;
    }

    selectionLayer.clear();

    if (selectionSet.size > 0) {
      selectionLayer.lineStyle(3, 0xe4ba60, 0.95);
      selectionLayer.beginFill(0xfccf6c, 0.12);
      for (const key of selectionSet) {
        const coord = parseAxialKey(key);
        const center = axialToPixel(coord, calibration);
        selectionLayer.drawPolygon(hexPoints(center, calibration.hexSizePx));
      }
      selectionLayer.endFill();
    }

    if (localHoverCoord) {
      const center = axialToPixel(localHoverCoord, calibration);
      selectionLayer.lineStyle(2, 0xf7e9b5, 0.85);
      selectionLayer.beginFill(0xf7e9b5, 0.08);
      selectionLayer.drawPolygon(hexPoints(center, calibration.hexSizePx));
      selectionLayer.endFill();
    }

    if (lineStart) {
      const center = axialToPixel(lineStart, calibration);
      selectionLayer.lineStyle(4, 0x7fd5ff, 0.95);
      selectionLayer.drawPolygon(hexPoints(center, calibration.hexSizePx));
    }
  }, [appReady, calibration, lineStart, localHoverCoord, selectionSet]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const app = appRef.current;
    const world = worldRef.current;
    if (!app || !world) {
      return;
    }

    const canvas = app.canvas;
    const activeWorld = world;

    function clientToScreenPoint(clientX: number, clientY: number): { x: number; y: number } {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
      const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    function screenToAxial(clientX: number, clientY: number): AxialCoord | null {
      const { x, y } = clientToScreenPoint(clientX, clientY);

      const worldX = (x - activeWorld.position.x) / activeWorld.scale.x;
      const worldY = (y - activeWorld.position.y) / activeWorld.scale.y;

      const coord = pixelToAxial({ x: worldX, y: worldY }, calibration);
      if (!isWithinBounds(coord, bounds)) {
        return null;
      }
      return coord;
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.code === "Space") {
        spaceDownRef.current = true;
        canvas.classList.add("is-grabbing");
      }
    }

    function onKeyUp(event: KeyboardEvent): void {
      if (event.code === "Space") {
        spaceDownRef.current = false;
        if (!isPanningRef.current) {
          canvas.classList.remove("is-grabbing");
        }
      }
    }

    function onPointerDown(event: PointerEvent): void {
      canvas.setPointerCapture(event.pointerId);

      const axial = screenToAxial(event.clientX, event.clientY);
      const isPanGesture = event.button === 1 || event.button === 2 || spaceDownRef.current;

      if (isPanGesture) {
        isPanningRef.current = true;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        canvas.classList.add("is-grabbing");
        return;
      }

      if (event.button !== 0) {
        return;
      }

      if (!axial) {
        if (lastHoverKeyRef.current !== null) {
          lastHoverKeyRef.current = null;
          setLocalHoverCoord(null);
          onHover(null);
        }
        return;
      }

      onPrimaryAction(axial, event.shiftKey);

      if (shouldTrackStroke(activeTool)) {
        onStrokeStart();
        isPaintingRef.current = true;
        lastPaintedKeyRef.current = axialKey(axial);
      }
    }

    function onPointerMove(event: PointerEvent): void {
      const axial = screenToAxial(event.clientX, event.clientY);
      const nextHoverKey = axial ? axialKey(axial) : null;
      if (nextHoverKey !== lastHoverKeyRef.current) {
        lastHoverKeyRef.current = nextHoverKey;
        setLocalHoverCoord(axial);
        onHover(axial);
      }

      if (isPanningRef.current && lastPointerRef.current) {
        const dx = event.clientX - lastPointerRef.current.x;
        const dy = event.clientY - lastPointerRef.current.y;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };

        cameraRef.current.x += dx;
        cameraRef.current.y += dy;
        hasUserMovedCameraRef.current = true;

        activeWorld.position.set(cameraRef.current.x, cameraRef.current.y);
      }

      if (!isPaintingRef.current || !axial) {
        return;
      }

      const nextKey = axialKey(axial);
      if (nextKey === lastPaintedKeyRef.current) {
        return;
      }

      lastPaintedKeyRef.current = nextKey;
      onDragAction(axial);
    }

    function onPointerUp(event: PointerEvent): void {
      if (isPaintingRef.current) {
        isPaintingRef.current = false;
        lastPaintedKeyRef.current = null;
        onStrokeEnd();
      }

      if (isPanningRef.current) {
        isPanningRef.current = false;
        lastPointerRef.current = null;
        if (!spaceDownRef.current) {
          canvas.classList.remove("is-grabbing");
        }
      }

      canvas.releasePointerCapture(event.pointerId);
    }

    function onWheel(event: WheelEvent): void {
      event.preventDefault();

      const { x: mouseX, y: mouseY } = clientToScreenPoint(event.clientX, event.clientY);

      const worldX = (mouseX - cameraRef.current.x) / cameraRef.current.scale;
      const worldY = (mouseY - cameraRef.current.y) / cameraRef.current.scale;

      const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;
      const nextScale = Math.min(3.5, Math.max(0.25, cameraRef.current.scale * zoomFactor));

      cameraRef.current.scale = nextScale;
      cameraRef.current.x = mouseX - worldX * nextScale;
      cameraRef.current.y = mouseY - worldY * nextScale;
      hasUserMovedCameraRef.current = true;

      activeWorld.position.set(cameraRef.current.x, cameraRef.current.y);
      activeWorld.scale.set(nextScale);
    }

    function onContextMenu(event: MouseEvent): void {
      event.preventDefault();
    }

    function onPointerLeave(): void {
      if (lastHoverKeyRef.current !== null) {
        lastHoverKeyRef.current = null;
        setLocalHoverCoord(null);
        onHover(null);
      }
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    appReady,
    activeTool,
    bounds,
    calibration,
    onDragAction,
    onHover,
    onPrimaryAction,
    onStrokeEnd,
    onStrokeStart,
  ]);

  useEffect(() => {
    if (!appReady) {
      return;
    }

    const app = appRef.current;
    const world = worldRef.current;
    const root = rootRef.current;
    if (!app || !world || !root) {
      return;
    }

    hasUserMovedCameraRef.current = false;

    const fitCamera = () => {
      if (hasUserMovedCameraRef.current) {
        return;
      }

      const viewportWidth = Math.max(1, app.screen.width);
      const viewportHeight = Math.max(1, app.screen.height);

      const envelope = boundsPixelEnvelope(bounds, calibration);
      const mapWidth = Math.max(1, envelope.maxX - envelope.minX);
      const mapHeight = Math.max(1, envelope.maxY - envelope.minY);
      const padding = Math.min(72, Math.floor(Math.min(viewportWidth, viewportHeight) * 0.12));

      const fitScaleX = (viewportWidth - padding * 2) / mapWidth;
      const fitScaleY = (viewportHeight - padding * 2) / mapHeight;
      const fittedScale = Math.min(fitScaleX, fitScaleY);
      const scale = Math.max(0.045, Math.min(1.35, fittedScale * COMFORT_ZOOM));

      cameraRef.current.scale = Number.isFinite(scale) ? scale : 1;
      cameraRef.current.x =
        (viewportWidth - mapWidth * cameraRef.current.scale) / 2 - envelope.minX * cameraRef.current.scale;
      cameraRef.current.y =
        (viewportHeight - mapHeight * cameraRef.current.scale) / 2 - envelope.minY * cameraRef.current.scale;

      world.position.set(cameraRef.current.x, cameraRef.current.y);
      world.scale.set(cameraRef.current.scale);
    };

    fitCamera();
    const frameA = requestAnimationFrame(fitCamera);
    const frameB = requestAnimationFrame(fitCamera);

    const resizeObserver = new ResizeObserver(() => {
      fitCamera();
    });
    resizeObserver.observe(root);

    window.addEventListener("resize", fitCamera);

    return () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitCamera);
    };
  }, [appReady, bounds, calibration]);

  return <div className="map-canvas-root" ref={rootRef} />;
}
