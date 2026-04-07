import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import pokemonData from '../../assets/data/pokemon.json';

const ALL_POKEMON = pokemonData.pokemon ?? [];

function InfoCard({ title, children }) {
  return (
    <div className="pdx-detail-card">
      <h3 className="pdx-detail-card-title">{title}</h3>
      <div className="pdx-detail-card-body">{children}</div>
    </div>
  );
}

function TagList({ items, className = '' }) {
  if (!items?.length) return <span className="pdx-detail-empty">—</span>;
  return (
    <div className="pdx-tag-list">
      {items.map((item) => (
        <span key={item} className={`pdx-tag ${className}`}>{item}</span>
      ))}
    </div>
  );
}

export default function PokedexDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const pokemon  = ALL_POKEMON.find((p) => p.slug === slug);

  if (!pokemon) {
    return (
      <div className="pdx-page">
        <div className="pdx-empty">
          找不到此寶可夢
          <button className="pdx-back" onClick={() => navigate('/pokedex')}>← 返回圖鑑</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pdx-page">
      <header className="pdx-header">
        <button className="pdx-back" onClick={() => navigate('/pokedex')}>← 圖鑑</button>
        <h1 className="pdx-title">{pokemon.nameChinese}</h1>
        <span className="pdx-count">No.{pokemon.number}</span>
      </header>

      <div className="pdx-detail-wrap">

        {/* ── 上方：圖片 + 基本資訊同一列 ── */}
        <div className="pdx-detail-top">
          <div className="pdx-detail-hero">
            {pokemon.pokemonImageFile ? (
              <img
                src={`/images/pokemon/${pokemon.pokemonImageFile}`}
                alt={pokemon.nameChinese}
                className="pdx-detail-img"
              />
            ) : (
              <div className="pdx-card-img-placeholder pdx-card-img-placeholder--lg">?</div>
            )}
          </div>

          <div className="pdx-detail-basic">
            <div className="pdx-detail-row">
              <span className="pdx-detail-label">中文名稱</span>
              <span className="pdx-detail-value">{pokemon.nameChinese}</span>
            </div>
            <div className="pdx-detail-row">
              <span className="pdx-detail-label">英文名稱</span>
              <span className="pdx-detail-value">{pokemon.nameEnglish}</span>
            </div>
            <div className="pdx-detail-row">
              <span className="pdx-detail-label">編號</span>
              <span className="pdx-detail-value">No.{pokemon.number}</span>
            </div>
            <div className="pdx-detail-row">
              <span className="pdx-detail-label">屬性</span>
              <div className="pdx-tag-list">
                {pokemon.types?.map((t) => (
                  <span key={t} className={`pdx-type pdx-type--${t}`}>{t}</span>
                ))}
              </div>
            </div>
            <div className="pdx-detail-row">
              <span className="pdx-detail-label">獲取方式</span>
              <TagList items={pokemon.obtainMethod} />
            </div>
            {pokemon.isEvent && (
              <div className="pdx-detail-row">
                <span className="pdx-event-badge">🎉 活動限定</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 下方：2 欄資訊卡片 ── */}
        <div className="pdx-detail-cards">
          <InfoCard title="特長">
            <TagList items={pokemon.specialties} className="pdx-tag--green" />
          </InfoCard>

          <InfoCard title="出現時間">
            <TagList items={pokemon.spawnTime} />
          </InfoCard>

          <InfoCard title="天氣">
            <TagList items={pokemon.weather} />
          </InfoCard>

          <InfoCard title="喜歡的環境">
            <TagList items={pokemon.environment} />
          </InfoCard>

          <InfoCard title="喜好">
            <TagList items={pokemon.favorites} className="pdx-tag--blue" />
          </InfoCard>

          <InfoCard title="棲息地">
            {pokemon.habitats?.length ? (
              <div className="pdx-habitat-list">
                {pokemon.habitats.map((h) => (
                  <div key={h.slug} className="pdx-habitat-item">
                    {h.imageFile && (
                      <img
                        src={`/images/habitats/${h.imageFile}`}
                        alt={h.name}
                        className="pdx-habitat-img"
                      />
                    )}
                    <span className="pdx-habitat-name">{h.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="pdx-detail-empty">—</span>
            )}
          </InfoCard>
        </div>
      </div>
    </div>
  );
}
