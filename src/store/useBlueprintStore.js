import { create } from 'zustand';
import { MATERIALS } from '../constants/materials';

const useBlueprintStore = create((set, get) => ({
  layers: {},
  currentLayer: 1,
  currentMat: 'grass',
  eraseMode: false,
  displayUpToLayer: 20,   // 3D 顯示到第幾層

  // ── 選擇工具 ──────────────────────────────
  selectMat: (matId) => set({ currentMat: matId, eraseMode: false }),
  toggleErase: () => set((s) => ({ eraseMode: !s.eraseMode })),

  // ── 編輯層數 ──────────────────────────────
  changeLayer: (delta) =>
    set((s) => ({
      currentLayer: Math.max(1, Math.min(20, s.currentLayer + delta)),
    })),

  // ── 3D 顯示層數 ───────────────────────────
  setDisplayUpToLayer: (val) =>
    set({ displayUpToLayer: Math.max(1, Math.min(20, val)) }),

  // ── 取得指定層的方塊 map ──────────────────
  getLayer: (y) => {
    const { layers } = get();
    return layers[y] ?? {};
  },

  // ── 放置 / 刪除單格 ───────────────────────
  paintCell: (x, z) => {
    const { currentLayer, currentMat, eraseMode, layers } = get();
    const key = `${x},${z}`;
    const layerData = layers[currentLayer] ?? {};

    let next;
    if (eraseMode) {
      if (!layerData[key]) return;
      const { [key]: _, ...rest } = layerData;
      next = rest;
    } else {
      if (layerData[key] === currentMat) return;
      next = { ...layerData, [key]: currentMat };
    }

    set({ layers: { ...layers, [currentLayer]: next } });
  },

  // ── 清除此層 ──────────────────────────────
  clearLayer: () => {
    const { currentLayer, layers } = get();
    set({ layers: { ...layers, [currentLayer]: {} } });
  },

  // ── 匯出 JSON ─────────────────────────────
  exportJSON: () => {
    const { layers } = get();
    const data = {
      version: 1,
      grid: 100,
      maxLayers: 20,
      materials: MATERIALS.map((m) => ({ id: m.id, name: m.name, color: m.color })),
      layers: Object.fromEntries(
        Object.entries(layers).filter(([, v]) => Object.keys(v).length > 0)
      ),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `pokopia-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── 匯入 JSON ─────────────────────────────
  importJSON: (jsonString) => {
    const data = JSON.parse(jsonString);
    const parsed = {};
    Object.entries(data.layers).forEach(([y, cells]) => {
      parsed[parseInt(y)] = cells;
    });
    set({ layers: parsed, currentLayer: 1, displayUpToLayer: 20 });
  },

  // ── 統計 ──────────────────────────────────
  totalBlocks: () => {
    const { layers } = get();
    return Object.values(layers).reduce((n, l) => n + Object.keys(l).length, 0);
  },
}));

export default useBlueprintStore;