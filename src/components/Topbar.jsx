import React, { useRef } from 'react';
import useBlueprintStore from '../store/useBlueprintStore.js';
import { MATERIALS } from '../constants/materials.js';

export default function Topbar({ onHome }) {
  const {
    currentMat, eraseMode, currentLayer,
    displayUpToLayer, setDisplayUpToLayer,
    selectMat, toggleErase, changeLayer,
    clearLayer, exportJSON, importJSON, totalBlocks,
  } = useBlueprintStore();

  const fileRef = useRef();

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { importJSON(ev.target.result); }
      catch (err) { alert('匯入失敗：' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="topbar">
      {/* 返回首頁 */}
      {onHome && (
        <>
          <button className="tool-btn home-btn" onClick={onHome}>← 首頁</button>
          <div className="sep" />
        </>
      )}

      <span className="topbar-title">Pokopia 藍圖</span>
      <div className="sep" />

      {/* 材質選擇 */}
      <div className="mat-list">
        {MATERIALS.map((m) => (
          <button
            key={m.id}
            className={`mat-btn ${currentMat === m.id && !eraseMode ? 'active' : ''}`}
            onClick={() => selectMat(m.id)}
          >
            <span className="mat-dot" style={{ background: m.color }} />
            {m.name}
          </button>
        ))}
      </div>

      <div className="sep" />

      <button className={`tool-btn ${eraseMode ? 'danger' : ''}`} onClick={toggleErase}>
        橡皮擦
      </button>
      <button className="tool-btn" onClick={clearLayer}>清除此層</button>

      <div className="sep" />

      <button className="tool-btn" onClick={exportJSON}>匯出 JSON</button>
      <button className="tool-btn" onClick={() => fileRef.current.click()}>匯入 JSON</button>
      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />

      <div className="sep" />

      <span className="block-count">方塊：{totalBlocks()}</span>
      <div className="sep" />

      <div className="layer-ctrl">
        <span className="layer-label">3D 顯示至</span>
        <button className="lbtn" onClick={() => setDisplayUpToLayer(displayUpToLayer - 1)}>−</button>
        <span className="layer-val">{displayUpToLayer}F</span>
        <button className="lbtn" onClick={() => setDisplayUpToLayer(displayUpToLayer + 1)}>+</button>
      </div>

      <div className="sep" />

      <div className="layer-ctrl">
        <span className="layer-label">編輯層</span>
        <button className="lbtn" onClick={() => changeLayer(-1)}>−</button>
        <span className="layer-val">{currentLayer}F</span>
        <button className="lbtn" onClick={() => changeLayer(1)}>+</button>
        <span className="layer-hint">y = {currentLayer}</span>
      </div>
    </header>
  );
}
