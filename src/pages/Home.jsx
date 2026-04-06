import React from 'react';
import { useNavigate } from 'react-router-dom';

const MENU_ITEMS = [
  {
    path:  '/blueprint',
    label: '藍圖編輯器',
    desc:  '規劃方塊建築的 2D／3D 藍圖',
    icon:  '🏗️',
    ready: true,
  },
  {
    path:  '/allocator',
    label: '寶可夢分配器',
    desc:  '將寶可夢拖拉分配到各地圖區塊',
    icon:  '🗺️',
    ready: false,
  },
  {
    path:  '/pokedex',
    label: '寶可夢圖鑑',
    desc:  '搜尋、篩選、查看所有寶可夢資料',
    icon:  '📖',
    ready: true,
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      <div className="home-inner">
        <div className="home-header">
          <h1 className="home-title">Pokopia 工具箱</h1>
          <p className="home-subtitle">選擇你要使用的功能</p>
        </div>

        <nav className="home-menu">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`menu-card ${!item.ready ? 'menu-card--soon' : ''}`}
              onClick={() => item.ready && navigate(item.path)}
              disabled={!item.ready}
            >
              <span className="menu-icon">{item.icon}</span>
              <div className="menu-text">
                <span className="menu-label">{item.label}</span>
                <span className="menu-desc">{item.desc}</span>
              </div>
              {!item.ready && <span className="menu-badge">即將推出</span>}
              {item.ready  && <span className="menu-arrow">→</span>}
            </button>
          ))}
        </nav>

        <p className="home-footer">Pokopia Blueprint Editor</p>
      </div>
    </div>
  );
}
