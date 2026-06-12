import React, { useRef } from 'react';
import useBlueprintStore from '../store/useBlueprintStore.js';

export default function Topbar({ onHome }) {
  const exportJSON = useBlueprintStore((s) => s.exportJSON);
  const importJSON = useBlueprintStore((s) => s.importJSON);
  const totalBlocks = useBlueprintStore((s) =>
    Object.values(s.layers).reduce((n, l) => n + Object.keys(l).length, 0)
  );

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
      {onHome && (
        <button className="top-btn home-btn" onClick={onHome}>← 首頁</button>
      )}

      <span className="topbar-title">🏠 Pokopia 藍圖</span>

      <span className="block-count">方塊 {totalBlocks}</span>

      <div className="topbar-actions">
        <button className="top-btn" onClick={exportJSON}>匯出 JSON</button>
        <button className="top-btn" onClick={() => fileRef.current.click()}>匯入 JSON</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>
    </header>
  );
}
