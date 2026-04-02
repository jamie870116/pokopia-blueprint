import React, { useRef, useEffect, useCallback, useState } from 'react';
import useBlueprintStore from '../store/useBlueprintStore';
import { MATERIALS, GRID } from '../constants/materials';

// ── 素材統計區塊 ────────────────────────────────
function MaterialStats() {
  const { layers } = useBlueprintStore();

  const stats = MATERIALS.map((mat) => {
    let count = 0;
    Object.values(layers).forEach((layer) => {
      Object.values(layer).forEach((matId) => {
        if (matId === mat.id) count++;
      });
    });
    return { ...mat, count };
  }).filter((m) => m.count > 0);

  const total = stats.reduce((n, m) => n + m.count, 0);

  return (
    <div className="stats-panel">
      <div className="stats-title">素材統計</div>
      {stats.length === 0 ? (
        <div className="stats-empty">尚未放置任何方塊</div>
      ) : (
        <>
          {stats.map((m) => (
            <div key={m.id} className="stats-row">
              <span className="stats-dot" style={{ background: m.color }} />
              <span className="stats-name">{m.name}</span>
              <span className="stats-bar-wrap">
                <span
                  className="stats-bar"
                  style={{ width: `${(m.count / total) * 100}%`, background: m.color }}
                />
              </span>
              <span className="stats-count">{m.count}</span>
            </div>
          ))}
          <div className="stats-total">合計：{total} 格</div>
        </>
      )}
    </div>
  );
}

// ── 2D 編輯器主體 ───────────────────────────────
export default function Editor2D() {
  const canvasRef = useRef(null);
  const wrapRef   = useRef(null);
  const stateRef  = useRef({
    cellSize: 6,
    viewX: 0,
    viewY: 0,
    isDrawing: false,
    isPanning: false,
    panStart: null,
    panOrigin: null,
  });

  const [cellSizeDisplay, setCellSizeDisplay] = useState(6);
  const { getLayer, paintCell, currentLayer, eraseMode } = useBlueprintStore();

  // ── 重繪 ──────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { cellSize, viewX, viewY } = stateRef.current;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#090d12';
    ctx.fillRect(0, 0, W, H);

    const layer  = getLayer(currentLayer);
    const startX = Math.max(0, Math.floor(viewX / cellSize));
    const startZ = Math.max(0, Math.floor(viewY / cellSize));
    const endX   = Math.min(GRID, Math.ceil((viewX + W) / cellSize));
    const endZ   = Math.min(GRID, Math.ceil((viewY + H) / cellSize));

    for (let x = startX; x < endX; x++) {
      for (let z = startZ; z < endZ; z++) {
        const sx    = x * cellSize - viewX;
        const sy    = z * cellSize - viewY;
        const matId = layer[`${x},${z}`];

        if (matId) {
          const mat = MATERIALS.find((m) => m.id === matId);
          ctx.fillStyle = mat?.color ?? '#888';
          ctx.fillRect(sx, sy, cellSize, cellSize);
        }
        if (cellSize >= 4) {
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(sx, sy, cellSize, cellSize);
        }
      }
    }

    // 地圖邊框
    ctx.strokeStyle = 'rgba(88,166,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-viewX, -viewY, GRID * cellSize, GRID * cellSize);
  }, [currentLayer, getLayer]);

  useEffect(() => { draw(); }, [draw, currentLayer]);
  useEffect(() => useBlueprintStore.subscribe(draw), [draw]);

  // ── Resize ────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      draw();
    });
    ro.observe(wrap);
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    draw();
    return () => ro.disconnect();
  }, [draw]);

  // ── 輔助 ──────────────────────────────────────
  const screenToGrid = (sx, sy) => {
    const { cellSize, viewX, viewY } = stateRef.current;
    return {
      gx: Math.floor((sx + viewX) / cellSize),
      gz: Math.floor((sy + viewY) / cellSize),
    };
  };

  const clampView = (canvas) => {
    const s = stateRef.current;
    s.viewX = Math.max(-canvas.width  * 0.5, Math.min(GRID * s.cellSize - canvas.width  * 0.1, s.viewX));
    s.viewY = Math.max(-canvas.height * 0.5, Math.min(GRID * s.cellSize - canvas.height * 0.1, s.viewY));
  };

  // ── 縮放按鈕 ─────────────────────────────────
  const zoomBy = (factor) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;
    const gxBefore = (cx + s.viewX) / s.cellSize;
    const gzBefore = (cy + s.viewY) / s.cellSize;
    s.cellSize = Math.max(2, Math.min(40, s.cellSize * factor));
    s.viewX = gxBefore * s.cellSize - cx;
    s.viewY = gzBefore * s.cellSize - cy;
    clampView(canvas);
    setCellSizeDisplay(Math.round(s.cellSize));
    draw();
  };

  const zoomIn    = () => zoomBy(1.3);
  const zoomOut   = () => zoomBy(1 / 1.3);
  const zoomReset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = stateRef.current;
    s.cellSize = 6;
    s.viewX = 0;
    s.viewY = 0;
    setCellSizeDisplay(6);
    draw();
  };

  // ── Mouse 事件 ────────────────────────────────
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (e.button === 1 || e.button === 2) {
      s.isPanning = true;
      s.panStart  = { x: e.clientX, y: e.clientY };
      s.panOrigin = { x: s.viewX, y: s.viewY };
      canvas.style.cursor = 'grabbing';
      return;
    }
    s.isDrawing = true;
    const r = canvas.getBoundingClientRect();
    const { gx, gz } = screenToGrid(e.clientX - r.left, e.clientY - r.top);
    if (gx >= 0 && gx < GRID && gz >= 0 && gz < GRID) paintCell(gx, gz);
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    const r = canvas.getBoundingClientRect();
    if (s.isPanning) {
      s.viewX = s.panOrigin.x - (e.clientX - s.panStart.x);
      s.viewY = s.panOrigin.y - (e.clientY - s.panStart.y);
      clampView(canvas);
      draw();
      return;
    }
    if (s.isDrawing) {
      const { gx, gz } = screenToGrid(e.clientX - r.left, e.clientY - r.top);
      if (gx >= 0 && gx < GRID && gz >= 0 && gz < GRID) paintCell(gx, gz);
    }
  };

  const handleMouseUp = () => {
    const s = stateRef.current;
    s.isDrawing = false;
    if (s.isPanning) {
      s.isPanning = false;
      canvasRef.current.style.cursor = eraseMode ? 'cell' : 'crosshair';
    }
  };

  // ── Touchpad：雙指滑動平移 ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const s = stateRef.current;
      s.viewX += e.deltaX;
      s.viewY += e.deltaY;
      clampView(canvas);
      draw();
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [draw]);

  return (
    <div className="panel left-panel">
      <div className="panel-info">
        2D 編輯 100×100 ｜ 左鍵繪製 · 右鍵平移 · 雙指滑動平移
      </div>

      {/* 縮放按鈕列 */}
      <div className="zoom-bar">
        <button className="zoom-btn" onClick={zoomOut}>−</button>
        <button className="zoom-btn zoom-reset" onClick={zoomReset} title="重設縮放">
          {cellSizeDisplay}px
        </button>
        <button className="zoom-btn" onClick={zoomIn}>+</button>
      </div>

      {/* 格子畫布 */}
      <div ref={wrapRef} className="canvas-wrap">
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            cursor: eraseMode ? 'cell' : 'crosshair',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* 素材統計 */}
      <MaterialStats />
    </div>
  );
}
