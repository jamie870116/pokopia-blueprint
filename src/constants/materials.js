import blocksData from '../assets/data/blocks.json';

export const GRID = 100;
export const MAX_LAYERS = 20;

// Legacy palette — these ids are stored inside exported blueprints,
// so they must never be removed or renamed.
export const BASE_MATERIALS = [
  { id: 'grass', name: '草地',   color: '#5D8A3C', hex: 0x5D8A3C },
  { id: 'water', name: '水',     color: '#3B7FC4', hex: 0x3B7FC4 },
  { id: 'wood',  name: '木頭',   color: '#8B5E3C', hex: 0x8B5E3C },
  { id: 'stone', name: '石頭',   color: '#7D7D7D', hex: 0x7D7D7D },
  { id: 'brick', name: '磚塊',   color: '#A0522D', hex: 0xA0522D },
  { id: 'lime',  name: '石灰',   color: '#D4D0C8', hex: 0xD4D0C8 },
  { id: 'plank', name: '木棧板', color: '#C19A5B', hex: 0xC19A5B },
].map((m) => ({ ...m, category: '基本', image: null, nameEnglish: '' }));

// Game blocks scraped from pokopiaguide.com (scripts/scrape-blocks.js)
export const BLOCK_MATERIALS = blocksData.blocks.map((b) => ({
  id: b.id,
  name: b.nameChinese || b.name,
  nameEnglish: b.name,
  color: b.color,
  hex: b.hex,
  category: '方塊',
  image: b.image ? `/images/blocks/${b.image}` : null,
}));

export const MATERIALS = [...BASE_MATERIALS, ...BLOCK_MATERIALS];
export const MATERIAL_MAP = new Map(MATERIALS.map((m) => [m.id, m]));
export const MATERIAL_CATEGORIES = ['基本', '方塊'];
