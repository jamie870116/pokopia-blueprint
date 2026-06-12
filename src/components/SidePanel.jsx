import React, { useMemo } from 'react';
import useBlueprintStore from '../store/useBlueprintStore';
import { MATERIALS, MAX_LAYERS } from '../constants/materials';

const TOOLS = [
  { id: 'paint', icon: '✏️', label: '畫筆', shortcut: 'B' },
  { id: 'erase', icon: '🧽', label: '橡皮擦', shortcut: 'E' },
  { id: 'fill', icon: '🪣', label: '油漆桶', shortcut: 'G' },
];

function ToolSection() {
  const tool = useBlueprintStore((s) => s.tool);
  const setTool = useBlueprintStore((s) => s.setTool);
  const undo = useBlueprintStore((s) => s.undo);
  const redo = useBlueprintStore((s) => s.redo);
  const canUndo = useBlueprintStore((s) => s.undoStack.length > 0);
  const canRedo = useBlueprintStore((s) => s.redoStack.length > 0);

  return (
    <section className="side-section">
      <h3 className="side-title">工具</h3>
      <div className="tool-grid">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-card ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={`${t.label}（${t.shortcut}）`}
          >
            <span className="tool-icon">{t.icon}</span>
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="history-row">
        <button className="side-btn" onClick={undo} disabled={!canUndo} title="復原（Ctrl+Z）">
          ↩ 復原
        </button>
        <button className="side-btn" onClick={redo} disabled={!canRedo} title="重做（Ctrl+Shift+Z）">
          ↪ 重做
        </button>
      </div>
    </section>
  );
}

function MaterialSection() {
  const currentMat = useBlueprintStore((s) => s.currentMat);
  const tool = useBlueprintStore((s) => s.tool);
  const selectMat = useBlueprintStore((s) => s.selectMat);

  return (
    <section className="side-section">
      <h3 className="side-title">材質</h3>
      <div className="mat-grid">
        {MATERIALS.map((m) => (
          <button
            key={m.id}
            className={`mat-swatch ${currentMat === m.id && tool !== 'erase' ? 'active' : ''}`}
            onClick={() => selectMat(m.id)}
            title={m.name}
          >
            <span className="mat-color" style={{ background: m.color }} />
            <span className="mat-name">{m.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function LayerSection() {
  const currentLayer = useBlueprintStore((s) => s.currentLayer);
  const displayUpToLayer = useBlueprintStore((s) => s.displayUpToLayer);
  const hasCopied = useBlueprintStore((s) => s.copiedLayer !== null);
  const { changeLayer, setDisplayUpToLayer, copyLayer, pasteLayer, clearLayer } =
    useBlueprintStore.getState();

  return (
    <section className="side-section">
      <h3 className="side-title">樓層</h3>
      <div className="layer-row">
        <span className="layer-row-label">編輯層</span>
        <div className="stepper">
          <button className="stepper-btn" onClick={() => changeLayer(-1)} title="下一層（[）">−</button>
          <span className="stepper-val">{currentLayer}F</span>
          <button className="stepper-btn" onClick={() => changeLayer(1)} title="上一層（]）">+</button>
        </div>
      </div>
      <div className="layer-row">
        <span className="layer-row-label">3D 顯示至</span>
        <div className="stepper">
          <button className="stepper-btn" onClick={() => setDisplayUpToLayer(displayUpToLayer - 1)}>−</button>
          <span className="stepper-val">{displayUpToLayer}F</span>
          <button className="stepper-btn" onClick={() => setDisplayUpToLayer(displayUpToLayer + 1)}>+</button>
        </div>
      </div>
      <input
        type="range"
        className="layer-slider"
        min={1}
        max={MAX_LAYERS}
        value={displayUpToLayer}
        onChange={(e) => setDisplayUpToLayer(Number(e.target.value))}
        title="3D 顯示樓層"
      />
      <div className="layer-actions">
        <button className="side-btn" onClick={copyLayer} title="複製目前樓層">複製層</button>
        <button className="side-btn" onClick={pasteLayer} disabled={!hasCopied} title="貼到目前樓層">
          貼上層
        </button>
        <button className="side-btn danger" onClick={clearLayer} title="清空目前樓層">清除層</button>
      </div>
    </section>
  );
}

function StatsSection() {
  const layers = useBlueprintStore((s) => s.layers);

  const stats = useMemo(() => {
    const counts = {};
    Object.values(layers).forEach((layer) => {
      Object.values(layer).forEach((matId) => {
        counts[matId] = (counts[matId] ?? 0) + 1;
      });
    });
    return MATERIALS.map((m) => ({ ...m, count: counts[m.id] ?? 0 })).filter((m) => m.count > 0);
  }, [layers]);

  const total = stats.reduce((n, m) => n + m.count, 0);

  return (
    <section className="side-section stats-section">
      <h3 className="side-title">素材統計</h3>
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
          <div className="stats-total">合計 {total} 格</div>
        </>
      )}
    </section>
  );
}

export default function SidePanel() {
  return (
    <aside className="side-panel">
      <ToolSection />
      <MaterialSection />
      <LayerSection />
      <StatsSection />
    </aside>
  );
}
