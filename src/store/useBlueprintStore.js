import { create } from 'zustand';
import { MATERIALS, GRID, MAX_LAYERS } from '../constants/materials';

const HISTORY_LIMIT = 100;

const clampLayer = (y) => Math.max(1, Math.min(MAX_LAYERS, y));

// Non-reactive buffer that accumulates cell changes during a drag stroke,
// so one full drag becomes a single undo entry.
let strokeBuffer = null;
let strokeLayerY = null;

// Append an undo entry (capped) and invalidate the redo stack.
const withHistory = (state, entry) => ({
  undoStack: [...state.undoStack.slice(-(HISTORY_LIMIT - 1)), entry],
  redoStack: [],
});

// Apply one side ('before' | 'after') of an undo entry to a layer map.
const applyEntry = (layers, entry, side) => {
  const layerData = { ...(layers[entry.y] ?? {}) };
  Object.entries(entry.cells).forEach(([key, change]) => {
    const value = change[side];
    if (value === undefined) delete layerData[key];
    else layerData[key] = value;
  });
  return { ...layers, [entry.y]: layerData };
};

const useBlueprintStore = create((set, get) => ({
  layers: {},
  currentLayer: 1,
  currentMat: 'grass',
  tool: 'paint', // 'paint' | 'erase' | 'fill'
  displayUpToLayer: MAX_LAYERS,
  copiedLayer: null,
  undoStack: [],
  redoStack: [],

  // ── Tool / material selection ─────────────────
  selectMat: (matId) =>
    set((s) => ({
      currentMat: matId,
      // Picking a material while erasing means the user wants to paint again.
      tool: s.tool === 'erase' ? 'paint' : s.tool,
    })),
  setTool: (tool) => set({ tool }),

  // ── Layer controls ────────────────────────────
  changeLayer: (delta) =>
    set((s) => ({ currentLayer: clampLayer(s.currentLayer + delta) })),
  setDisplayUpToLayer: (val) => set({ displayUpToLayer: clampLayer(val) }),

  getLayer: (y) => get().layers[y] ?? {},

  // ── Stroke grouping (one drag = one undo step) ─
  beginStroke: () => {
    strokeBuffer = {};
    strokeLayerY = get().currentLayer;
  },
  endStroke: () => {
    if (strokeBuffer && Object.keys(strokeBuffer).length > 0) {
      const entry = { y: strokeLayerY, cells: strokeBuffer };
      set((s) => withHistory(s, entry));
    }
    strokeBuffer = null;
    strokeLayerY = null;
  },

  // ── Batch paint/erase (single set() per pointermove) ─
  paintCells: (keys) => {
    const { currentLayer, currentMat, tool, layers } = get();
    const layerData = layers[currentLayer] ?? {};
    const value = tool === 'erase' ? undefined : currentMat;

    let next = null;
    for (const key of keys) {
      const prev = layerData[key];
      if (prev === value) continue;
      if (!next) next = { ...layerData };
      if (strokeBuffer) {
        if (key in strokeBuffer) strokeBuffer[key].after = value;
        else strokeBuffer[key] = { before: prev, after: value };
      }
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    if (!next) return;
    set({ layers: { ...layers, [currentLayer]: next } });
  },

  // ── Flood fill (paint bucket) ─────────────────
  floodFill: (x, z) => {
    const { currentLayer, currentMat, tool, layers } = get();
    const layerData = layers[currentLayer] ?? {};
    const target = layerData[`${x},${z}`];
    const value = tool === 'erase' ? undefined : currentMat;
    if (target === value) return;

    const next = { ...layerData };
    const cells = {};
    const stack = [[x, z]];
    const seen = new Set([`${x},${z}`]);
    while (stack.length) {
      const [cx, cz] = stack.pop();
      const key = `${cx},${cz}`;
      cells[key] = { before: target, after: value };
      if (value === undefined) delete next[key];
      else next[key] = value;

      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nx >= GRID || nz < 0 || nz >= GRID) continue;
        const nkey = `${nx},${nz}`;
        if (seen.has(nkey) || layerData[nkey] !== target) continue;
        seen.add(nkey);
        stack.push([nx, nz]);
      }
    }

    set((s) => ({
      layers: { ...s.layers, [currentLayer]: next },
      ...withHistory(s, { y: currentLayer, cells }),
    }));
  },

  // ── Undo / Redo ───────────────────────────────
  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    set((s) => ({
      layers: applyEntry(s.layers, entry, 'before'),
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, entry],
      currentLayer: entry.y, // jump to the affected floor so the change is visible
    }));
  },
  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    set((s) => ({
      layers: applyEntry(s.layers, entry, 'after'),
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, entry],
      currentLayer: entry.y,
    }));
  },

  // ── Copy / paste floor layer ──────────────────
  copyLayer: () =>
    set((s) => ({ copiedLayer: { ...(s.layers[s.currentLayer] ?? {}) } })),
  pasteLayer: () => {
    const { copiedLayer, currentLayer, layers } = get();
    if (!copiedLayer) return;
    const before = layers[currentLayer] ?? {};
    const cells = {};
    new Set([...Object.keys(before), ...Object.keys(copiedLayer)]).forEach((key) => {
      if (before[key] !== copiedLayer[key]) {
        cells[key] = { before: before[key], after: copiedLayer[key] };
      }
    });
    if (Object.keys(cells).length === 0) return;
    set((s) => ({
      layers: { ...s.layers, [currentLayer]: { ...copiedLayer } },
      ...withHistory(s, { y: currentLayer, cells }),
    }));
  },

  // ── Clear current layer ───────────────────────
  clearLayer: () => {
    const { currentLayer, layers } = get();
    const layerData = layers[currentLayer] ?? {};
    const keys = Object.keys(layerData);
    if (keys.length === 0) return;
    const cells = {};
    keys.forEach((key) => {
      cells[key] = { before: layerData[key], after: undefined };
    });
    set((s) => ({
      layers: { ...s.layers, [currentLayer]: {} },
      ...withHistory(s, { y: currentLayer, cells }),
    }));
  },

  // ── Export JSON (format unchanged, version 1) ─
  exportJSON: () => {
    const { layers } = get();
    const data = {
      version: 1,
      grid: GRID,
      maxLayers: MAX_LAYERS,
      materials: MATERIALS.map((m) => ({ id: m.id, name: m.name, color: m.color })),
      layers: Object.fromEntries(
        Object.entries(layers).filter(([, v]) => Object.keys(v).length > 0)
      ),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokopia-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── Import JSON ───────────────────────────────
  importJSON: (jsonString) => {
    const data = JSON.parse(jsonString);
    const parsed = {};
    Object.entries(data.layers).forEach(([y, cells]) => {
      parsed[parseInt(y)] = cells;
    });
    set({
      layers: parsed,
      currentLayer: 1,
      displayUpToLayer: MAX_LAYERS,
      undoStack: [],
      redoStack: [],
    });
  },

  // ── Stats ─────────────────────────────────────
  totalBlocks: () => {
    const { layers } = get();
    return Object.values(layers).reduce((n, l) => n + Object.keys(l).length, 0);
  },
}));

export default useBlueprintStore;
