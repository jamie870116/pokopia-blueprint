import React, { useRef, useEffect, useCallback, useState } from 'react';
import useBlueprintStore from '../store/useBlueprintStore';
import { MATERIAL_MAP, GRID } from '../constants/materials';

const CURSORS = { paint: 'crosshair', erase: 'cell', fill: 'pointer' };
// Cells at or above this size render the block thumbnail instead of a flat color
const IMAGE_CELL_SIZE = 12;

// Canvas palette (bright theme)
const C_OUTSIDE = '#ede4d3';
const C_MAP_BG = '#fffdf6';
const C_GRID = 'rgba(106, 138, 74, 0.14)';
const C_GRID_SECTION = 'rgba(106, 138, 74, 0.32)';
const C_BORDER = '#6aa84f';
const C_HOVER = 'rgba(106, 168, 79, 0.85)';

// All grid cells on the line between two cells (Bresenham), clamped to the map.
function lineCells(x0, z0, x1, z1) {
  const cells = [];
  const dx = Math.abs(x1 - x0);
  const dz = Math.abs(z1 - z0);
  const sx = x0 < x1 ? 1 : -1;
  const sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  let x = x0;
  let z = z0;
  for (;;) {
    if (x >= 0 && x < GRID && z >= 0 && z < GRID) cells.push(`${x},${z}`);
    if (x === x1 && z === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
  }
  return cells;
}

export default function Editor2D() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const chipRef = useRef(null);
  const stateRef = useRef({
    cellSize: 6,
    viewX: 0,
    viewY: 0,
    isDrawing: false,
    isPanning: false,
    panStart: null,
    panOrigin: null,
    lastCell: null,
    hover: null,
    rafPending: false,
  });

  const [cellSizeDisplay, setCellSizeDisplay] = useState(6);
  const tool = useBlueprintStore((s) => s.tool);

  // Lazily loaded block thumbnails (id → { img, loaded })
  const imagesRef = useRef(new Map());

  // ── Redraw (reads the store imperatively; never re-renders React) ──
  const draw = useCallback(function drawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { cellSize, viewX, viewY, hover } = stateRef.current;
    const W = canvas.width;
    const H = canvas.height;
    const { layers, currentLayer } = useBlueprintStore.getState();
    const layer = layers[currentLayer] ?? {};

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C_OUTSIDE;
    ctx.fillRect(0, 0, W, H);

    // Map area background
    const mapX = -viewX;
    const mapY = -viewY;
    const mapSize = GRID * cellSize;
    ctx.fillStyle = C_MAP_BG;
    ctx.fillRect(mapX, mapY, mapSize, mapSize);

    const startX = Math.max(0, Math.floor(viewX / cellSize));
    const startZ = Math.max(0, Math.floor(viewY / cellSize));
    const endX = Math.min(GRID, Math.ceil((viewX + W) / cellSize));
    const endZ = Math.min(GRID, Math.ceil((viewY + H) / cellSize));

    // Blocks: thumbnail when zoomed in, dominant color otherwise
    const getImage = (mat) => {
      let entry = imagesRef.current.get(mat.id);
      if (!entry) {
        entry = { img: new Image(), loaded: false };
        entry.img.onload = () => {
          entry.loaded = true;
          requestAnimationFrame(drawCanvas);
        };
        entry.img.src = mat.image;
        imagesRef.current.set(mat.id, entry);
      }
      return entry;
    };

    for (let x = startX; x < endX; x++) {
      for (let z = startZ; z < endZ; z++) {
        const matId = layer[`${x},${z}`];
        if (!matId) continue;
        const mat = MATERIAL_MAP.get(matId);
        const sx = x * cellSize - viewX;
        const sy = z * cellSize - viewY;
        ctx.fillStyle = mat?.color ?? '#888';
        ctx.fillRect(sx, sy, cellSize, cellSize);
        if (mat?.image && cellSize >= IMAGE_CELL_SIZE) {
          const entry = getImage(mat);
          if (entry.loaded) ctx.drawImage(entry.img, sx, sy, cellSize, cellSize);
        }
      }
    }

    // Grid lines (minor lines hidden when zoomed far out)
    ctx.lineWidth = 1;
    for (let x = startX; x <= endX; x++) {
      const section = x % 10 === 0;
      if (!section && cellSize < 4) continue;
      ctx.strokeStyle = section ? C_GRID_SECTION : C_GRID;
      const sx = Math.round(x * cellSize - viewX) + 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, Math.max(0, mapY));
      ctx.lineTo(sx, Math.min(H, mapY + mapSize));
      ctx.stroke();
    }
    for (let z = startZ; z <= endZ; z++) {
      const section = z % 10 === 0;
      if (!section && cellSize < 4) continue;
      ctx.strokeStyle = section ? C_GRID_SECTION : C_GRID;
      const sy = Math.round(z * cellSize - viewY) + 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.max(0, mapX), sy);
      ctx.lineTo(Math.min(W, mapX + mapSize), sy);
      ctx.stroke();
    }

    // Map border
    ctx.strokeStyle = C_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    // Hover highlight
    if (hover) {
      const hx = hover.gx * cellSize - viewX;
      const hy = hover.gz * cellSize - viewY;
      ctx.fillStyle = 'rgba(106, 168, 79, 0.15)';
      ctx.fillRect(hx, hy, cellSize, cellSize);
      ctx.strokeStyle = C_HOVER;
      ctx.lineWidth = 2;
      ctx.strokeRect(hx + 1, hy + 1, cellSize - 2, cellSize - 2);
    }
  }, []);

  // At most one real redraw per animation frame
  const requestDraw = useCallback(() => {
    const s = stateRef.current;
    if (s.rafPending) return;
    s.rafPending = true;
    requestAnimationFrame(() => {
      s.rafPending = false;
      draw();
    });
  }, [draw]);

  // Redraw when blocks or the edited floor change
  useEffect(
    () =>
      useBlueprintStore.subscribe((state, prev) => {
        if (state.layers !== prev.layers || state.currentLayer !== prev.currentLayer) {
          requestDraw();
        }
      }),
    [requestDraw]
  );

  // ── Resize ────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    return () => ro.disconnect();
  }, [draw]);

  // ── Helpers ───────────────────────────────────
  const screenToGrid = (sx, sy) => {
    const { cellSize, viewX, viewY } = stateRef.current;
    return {
      gx: Math.floor((sx + viewX) / cellSize),
      gz: Math.floor((sy + viewY) / cellSize),
    };
  };

  const inBounds = ({ gx, gz }) => gx >= 0 && gx < GRID && gz >= 0 && gz < GRID;

  const clampView = (canvas) => {
    const s = stateRef.current;
    s.viewX = Math.max(-canvas.width * 0.5, Math.min(GRID * s.cellSize - canvas.width * 0.1, s.viewX));
    s.viewY = Math.max(-canvas.height * 0.5, Math.min(GRID * s.cellSize - canvas.height * 0.1, s.viewY));
  };

  const setHover = (cell) => {
    stateRef.current.hover = cell;
    const chip = chipRef.current;
    if (chip) {
      chip.style.display = cell ? 'block' : 'none';
      if (cell) chip.textContent = `(${cell.gx}, ${cell.gz})`;
    }
    requestDraw();
  };

  // ── Zoom (keeps the given screen point fixed) ─
  const zoomAt = (sx, sy, factor) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    const gxBefore = (sx + s.viewX) / s.cellSize;
    const gzBefore = (sy + s.viewY) / s.cellSize;
    s.cellSize = Math.max(2, Math.min(40, s.cellSize * factor));
    s.viewX = gxBefore * s.cellSize - sx;
    s.viewY = gzBefore * s.cellSize - sy;
    clampView(canvas);
    setCellSizeDisplay(Math.round(s.cellSize));
    requestDraw();
  };

  const zoomCenter = (factor) => {
    const canvas = canvasRef.current;
    if (canvas) zoomAt(canvas.width / 2, canvas.height / 2, factor);
  };

  const zoomReset = () => {
    const s = stateRef.current;
    s.cellSize = 6;
    s.viewX = 0;
    s.viewY = 0;
    setCellSizeDisplay(6);
    requestDraw();
  };

  // ── Pointer events ────────────────────────────
  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    canvas.setPointerCapture(e.pointerId);

    if (e.button === 1 || e.button === 2) {
      s.isPanning = true;
      s.panStart = { x: e.clientX, y: e.clientY };
      s.panOrigin = { x: s.viewX, y: s.viewY };
      canvas.style.cursor = 'grabbing';
      return;
    }

    const r = canvas.getBoundingClientRect();
    const cell = screenToGrid(e.clientX - r.left, e.clientY - r.top);
    if (!inBounds(cell)) return;

    const store = useBlueprintStore.getState();
    if (store.tool === 'fill') {
      store.floodFill(cell.gx, cell.gz);
      return;
    }

    s.isDrawing = true;
    s.lastCell = cell;
    store.beginStroke();
    store.paintCells([`${cell.gx},${cell.gz}`]);
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    const r = canvas.getBoundingClientRect();
    const cell = screenToGrid(e.clientX - r.left, e.clientY - r.top);

    setHover(inBounds(cell) ? cell : null);

    if (s.isPanning) {
      s.viewX = s.panOrigin.x - (e.clientX - s.panStart.x);
      s.viewY = s.panOrigin.y - (e.clientY - s.panStart.y);
      clampView(canvas);
      requestDraw();
      return;
    }

    if (s.isDrawing) {
      // Interpolate so fast drags leave no gaps
      const from = s.lastCell ?? cell;
      const keys = lineCells(from.gx, from.gz, cell.gx, cell.gz);
      if (keys.length) useBlueprintStore.getState().paintCells(keys);
      s.lastCell = cell;
    }
  };

  const stopInteraction = () => {
    const s = stateRef.current;
    if (s.isDrawing) {
      s.isDrawing = false;
      s.lastCell = null;
      useBlueprintStore.getState().endStroke();
    }
    if (s.isPanning) {
      s.isPanning = false;
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = CURSORS[useBlueprintStore.getState().tool];
    }
  };

  const handlePointerLeave = () => {
    if (!stateRef.current.isDrawing && !stateRef.current.isPanning) setHover(null);
  };

  // ── Trackpad: two-finger pan, pinch to zoom ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const s = stateRef.current;
      if (e.ctrlKey) {
        // Pinch gesture (or ctrl+wheel): zoom toward the cursor
        const r = canvas.getBoundingClientRect();
        zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
        return;
      }
      s.viewX += e.deltaX;
      s.viewY += e.deltaY;
      clampView(canvas);
      requestDraw();
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestDraw]);

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">2D 編輯</span>
        <span className="panel-hint">左鍵繪製 · 右鍵平移 · 雙指平移 · 捏合縮放</span>
        <div className="zoom-bar">
          <button className="zoom-btn" onClick={() => zoomCenter(1 / 1.3)} title="縮小">−</button>
          <button className="zoom-btn zoom-reset" onClick={zoomReset} title="重設縮放">
            {cellSizeDisplay}px
          </button>
          <button className="zoom-btn" onClick={() => zoomCenter(1.3)} title="放大">+</button>
        </div>
      </div>

      <div ref={wrapRef} className="canvas-wrap">
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, cursor: CURSORS[tool], touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopInteraction}
          onPointerCancel={stopInteraction}
          onPointerLeave={handlePointerLeave}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div ref={chipRef} className="coord-chip" style={{ display: 'none' }} />
      </div>
    </div>
  );
}
