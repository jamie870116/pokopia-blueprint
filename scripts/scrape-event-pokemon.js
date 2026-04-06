/**
 * Pokopia 活動寶可夢補充爬蟲
 * 執行方式：node scripts/scrape-event-pokemon.js
 * 將結果附加/更新到 src/assets/data/pokemon.json
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL    = 'https://pokopiaguide.com';
const OUTPUT      = path.resolve(__dirname, '../src/assets/data/pokemon.json');
const IMG_POKE    = path.resolve(__dirname, '../src/assets/images/pokemon');
const IMG_HABITAT = path.resolve(__dirname, '../src/assets/images/habitats');

// ════════════════════════════════════════════════
//  ★ 在這裡填入要補充的寶可夢 slug（英文小寫）
//    slug 就是網址最後一段：
//    https://pokopiaguide.com/zh/pokedex/pikachu → pikachu
// ════════════════════════════════════════════════
const EVENT_SLUGS = [
  'hoppip',     
  'skiploom',
  'jumpluff',
];

const DELAY = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9',
};

// ── 通用圖片下載 ────────────────────────────────
async function downloadImage(url, dir, filename) {
  try {
    const filepath = path.join(dir, filename);
    if (fs.existsSync(filepath)) return filename;
    const res = await axios.get(url, { responseType: 'arraybuffer', headers, timeout: 10000 });
    fs.writeFileSync(filepath, res.data);
    console.log(`    ✓ 圖片：${filename}`);
    return filename;
  } catch (err) {
    console.warn(`    ✗ 圖片失敗：${filename} — ${err.message}`);
    return null;
  }
}

// ── 詳細頁爬取（與主爬蟲相同邏輯）─────────────
async function fetchDetail(slug) {
  const detailUrl = `${BASE_URL}/zh/pokedex/${slug}`;
  const res = await axios.get(detailUrl, { headers, timeout: 15000 });
  const $   = cheerio.load(res.data);

  const number      = $('span.font-mono').first().text().trim().replace('No.', '');
  const nameChinese = $('h1').first().text().trim();
  const nameEnglish = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // 屬性（只在 hero 區塊）
  const typesSet  = new Set();
  const heroBlock = $('div[class*="group/hero"]').first();
  heroBlock.find('img[src*="/images/types/"]').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt) typesSet.add(alt);
  });
  const types = [...typesSet];

  // 寶可夢圖片
  let pokemonImageFile = null;
  let pokemonImageUrl  = null;
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('assets.pokopiaguide.com/pokemon/') && !pokemonImageUrl) {
      pokemonImageUrl = src;
    }
  });
  if (pokemonImageUrl) {
    const ext = pokemonImageUrl.split('.').pop().split('?')[0] || 'png';
    pokemonImageFile = await downloadImage(pokemonImageUrl, IMG_POKE, `${slug}.${ext}`);
  }

  // 資訊欄位
  const info = {};
  $('div.grid > div').each((_, card) => {
    const label = $(card).find('h3').first().text().trim();
    if (!label) return;

    switch (label) {
      case '特長': {
        const items = [];
        $(card).find('a[href*="/specialty/"], span.group').each((_, el) => {
          const text = $(el).find('span').last().text().trim();
          if (text) items.push(text);
        });
        info.specialties = [...new Set(items)];
        break;
      }
      case '出現時間': {
        const items = [];
        $(card).find('span.group').each((_, el) => {
          const text = $(el).find('span.font-medium').text().trim();
          if (text) items.push(text);
        });
        info.spawnTime = [...new Set(items)];
        break;
      }
      case '天氣': {
        const items = [];
        $(card).find('span.group').each((_, el) => {
          const text = $(el).find('span.font-medium').text().trim();
          if (text) items.push(text);
        });
        info.weather = [...new Set(items)];
        break;
      }
      case '喜歡的環境': {
        const items = [];
        $(card).find('span.group').each((_, el) => {
          const text = $(el).find('span.font-medium').text().trim();
          if (text) items.push(text);
        });
        info.environment = [...new Set(items)];
        break;
      }
      case '喜好': {
        const items = [];
        $(card).find('[data-slot="badge"]').each((_, el) => {
          const text = $(el).text().trim();
          if (text) items.push(text);
        });
        info.favorites = [...new Set(items)];
        break;
      }
      case '獲取方式': {
        const items = [];
        $(card).find('[data-slot="badge"]').each((_, el) => {
          const text = $(el).text().trim();
          if (text) items.push(text);
        });
        info.obtainMethod = [...new Set(items)];
        break;
      }
      case '棲息地': {
        info.habitatRaw = [];
        $(card).find('a[href^="/zh/habitat/"]').each((_, el) => {
          const name        = $(el).find('p').first().text().trim();
          const href        = $(el).attr('href');
          const imgSrc      = $(el).find('img').attr('src') || null;
          const habitatSlug = href.replace('/zh/habitat/', '');
          if (name) info.habitatRaw.push({ name, slug: habitatSlug, href, imageUrl: imgSrc });
        });
        break;
      }
    }
  });

  // 下載棲息地圖片
  const habitats = [];
  for (const h of (info.habitatRaw ?? [])) {
    let imageFile = null;
    if (h.imageUrl) {
      const imgUrl = h.imageUrl.startsWith('http') ? h.imageUrl : `${BASE_URL}${h.imageUrl}`;
      const ext    = imgUrl.split('.').pop().split('?')[0] || 'png';
      imageFile    = await downloadImage(imgUrl, IMG_HABITAT, `${h.slug}.${ext}`);
    }
    habitats.push({ name: h.name, slug: h.slug, href: h.href, imageFile });
  }

  return {
    slug,
    number,
    nameChinese,
    nameEnglish,
    pokemonImageFile,
    types,
    isEvent: true,        // 標記為活動寶可夢
    specialties:  info.specialties  ?? [],
    spawnTime:    info.spawnTime    ?? [],
    weather:      info.weather      ?? [],
    environment:  info.environment  ?? [],
    favorites:    info.favorites    ?? [],
    obtainMethod: info.obtainMethod ?? [],
    habitats,
  };
}

// ── 主程式 ──────────────────────────────────────
async function main() {
  console.log('🎉 活動寶可夢補充爬蟲啟動\n');
  console.log(`目標：${EVENT_SLUGS.join(', ')}\n`);

  fs.mkdirSync(IMG_POKE,    { recursive: true });
  fs.mkdirSync(IMG_HABITAT, { recursive: true });

  // 讀取現有 JSON
  let existing = { scraped_at: '', source: '', total: 0, pokemon: [] };
  if (fs.existsSync(OUTPUT)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
    console.log(`📂 現有資料：${existing.pokemon.length} 筆\n`);
  } else {
    console.warn('⚠️  找不到 pokemon.json, 將建立新檔案\n');
  }

  // 建立 slug → index 對照表，方便更新已存在的條目
  const slugIndex = {};
  existing.pokemon.forEach((p, i) => { slugIndex[p.slug] = i; });

  let added = 0, updated = 0, failed = 0;

  for (let i = 0; i < EVENT_SLUGS.length; i++) {
    const slug = EVENT_SLUGS[i].trim().toLowerCase();
    console.log(`[${i + 1}/${EVENT_SLUGS.length}] ⬇ ${slug}`);

    try {
      const data = await fetchDetail(slug);

      if (slug in slugIndex) {
        // 已存在 → 更新
        existing.pokemon[slugIndex[slug]] = data;
        updated++;
        console.log(`  ↺ 更新：${data.nameChinese} (${data.nameEnglish})No.${data.number}`);
      } else {
        // 不存在 → 附加
        existing.pokemon.push(data);
        slugIndex[slug] = existing.pokemon.length - 1;
        added++;
        console.log(`  ✓ 新增：${data.nameChinese} (${data.nameEnglish})No.${data.number}`);
      }
    } catch (err) {
      console.warn(`  ✗ 失敗：${err.message}`);
      failed++;
    }

    await sleep(DELAY);
  }

  // 寫回 JSON
  existing.scraped_at = new Date().toISOString();
  existing.total      = existing.pokemon.length;
  fs.writeFileSync(OUTPUT, JSON.stringify(existing, null, 2), 'utf-8');

  console.log(`\n✅ 完成！`);
  console.log(`   新增：${added} 更新：${updated} 失敗：${failed}`);
  console.log(`   總計：${existing.total} 筆`);
  console.log(`   輸出：${OUTPUT}`);
}

main().catch(console.error);