import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import pokemonData from '../../assets/data/pokemon.json';

const ALL_POKEMON = pokemonData.pokemon ?? [];
const PAGE_SIZE   = 30;

function unique(arr) {
  return [...new Set(arr.flat().filter(Boolean))].sort();
}

const ALL_TYPES   = unique(ALL_POKEMON.map((p) => p.types));
const ALL_SPECS   = unique(ALL_POKEMON.map((p) => p.specialties));
const ALL_FAVS    = unique(ALL_POKEMON.map((p) => p.favorites));
const ALL_ENVS    = unique(ALL_POKEMON.map((p) => p.environment));

const ZONES = ['空空鎮', '乾巴巴荒野', '陰沉沉海濱', '凸隆隆山地', '亮晶晶空島', '未分配'];

// ── Tag 多選列 ──────────────────────────────────
function TagRow({ label, items, selected, onToggle, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pdx-filter-section">
      <button className="pdx-filter-section-hd" onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <span className="pdx-filter-chevron">{open ? '∧' : '∨'}</span>
      </button>
      {open && (
        <div className="pdx-tag-row">
          {items.map((item) => (
            <button
              key={item}
              className={`pdx-filter-tag ${selected.has(item) ? 'pdx-filter-tag--on' : ''}`}
              onClick={() => onToggle(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PokedexList() {
  const navigate = useNavigate();

  const [search,   setSearch]   = useState('');
  const [types,    setTypes]    = useState(new Set());
  const [specs,    setSpecs]    = useState(new Set());
  const [favs,     setFavs]     = useState(new Set());
  const [envs,     setEnvs]     = useState(new Set());
  const [zone,     setZone]     = useState('全部');
  const [page,     setPage]     = useState(1);

  const toggle = (setter) => (val) =>
    setter((prev) => {
      const next = new Set(prev);
      next.has(val) ? next.delete(val) : next.add(val);
      setPage(1);
      return next;
    });

  const filtered = useMemo(() => {
    // setPage(1);
    return ALL_POKEMON.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.nameChinese?.includes(search) &&
            !p.nameEnglish?.toLowerCase().includes(q) &&
            !p.number?.includes(search)) return false;
      }
      if (types.size && !p.types?.some((t) => types.has(t))) return false;
      if (specs.size && !p.specialties?.some((s) => specs.has(s))) return false;
      if (favs.size  && !p.favorites?.some((f) => favs.has(f)))   return false;
      if (envs.size  && !p.environment?.some((e) => envs.has(e))) return false;
      return true;
    });
  }, [search, types, specs, favs, envs, zone]);

  const displayed = filtered.slice(0, page * PAGE_SIZE);
  const hasMore   = displayed.length < filtered.length;

  // Intersection Observer 無限滾動
  const loaderRef = useRef(null);
  const onLoader  = useCallback((node) => {
    if (loaderRef.current) loaderRef.current.disconnect();
    if (!node) return;
    loaderRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) setPage((p) => p + 1);
    });
    loaderRef.current.observe(node);
  }, [hasMore]);

  const hasFilter = search || types.size || specs.size || favs.size || envs.size || zone !== '全部';
  const clearAll  = () => {
    setSearch(''); setTypes(new Set()); setSpecs(new Set());
    setFavs(new Set()); setEnvs(new Set()); setZone('全部'); setPage(1);
  };

  return (
    <div className="pdx-page">
      <header className="pdx-header">
        <button className="pdx-back" onClick={() => navigate('/')}>← 首頁</button>
        <h1 className="pdx-title">寶可夢圖鑑</h1>
        <span className="pdx-count">{filtered.length} / {ALL_POKEMON.length}</span>
      </header>

      {/* ── 篩選面板 ── */}
      <div className="pdx-filter-panel">
        <TagRow label="按類型瀏覽" items={ALL_TYPES} selected={types} onToggle={toggle(setTypes)} defaultOpen />
        <TagRow label="按特長瀏覽" items={ALL_SPECS}  selected={specs} onToggle={toggle(setSpecs)} />
        <TagRow label="按喜好瀏覽" items={ALL_FAVS}   selected={favs}  onToggle={toggle(setFavs)} />
        <TagRow label="按喜歡的環境瀏覽" items={ALL_ENVS} selected={envs} onToggle={toggle(setEnvs)} />

        {/* 區域列 */}
        <div className="pdx-zone-row">
          {['全部', ...ZONES].map((z) => (
            <button
              key={z}
              className={`pdx-zone-btn ${zone === z ? 'pdx-zone-btn--on' : ''}`}
              onClick={() => { setZone(z); setPage(1); }}
            >{z}</button>
          ))}
        </div>

        {/* 搜尋 */}
        <div className="pdx-search-wrap">
          <span className="pdx-search-icon">🔍</span>
          <input
            className="pdx-search-input"
            placeholder="搜尋名稱或編號..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {hasFilter && (
            <button className="pdx-search-clear" onClick={clearAll}>✕ 清除篩選</button>
          )}
        </div>
      </div>

      {/* ── 列表 ── */}
      <div className="pdx-list-wrap">
        {filtered.length === 0 ? (
          <div className="pdx-empty">找不到符合條件的寶可夢</div>
        ) : (
          <>
            <div className="pdx-grid3">
              {displayed.map((p) => (
                <button
                  key={p.slug}
                  className="pdx-card"
                  onClick={() => navigate(`/pokedex/${p.slug}`)}
                >
                  <div className="pdx-card-img-wrap">
                    {p.pokemonImageFile ? (
                      <img
                        src={`/images/pokemon/${p.pokemonImageFile}`}
                        alt={p.nameChinese}
                        className="pdx-card-img"
                        loading="lazy"
                      />
                    ) : (
                      <div className="pdx-card-img-placeholder">?</div>
                    )}
                  </div>
                  <div className="pdx-card-info">
                    <span className="pdx-card-num">No.{p.number}</span>
                    <span className="pdx-card-name">{p.nameChinese}</span>
                    <div className="pdx-card-types">
                      {p.types?.map((t) => (
                        <span key={t} className={`pdx-type pdx-type--${t}`}>{t}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {hasMore && (
              <div ref={onLoader} className="pdx-loader">載入中...</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
