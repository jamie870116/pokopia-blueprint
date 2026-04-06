/**
 * Pokopia Pokédex Scraper
 * 執行方式：node scripts/scrape-pokemon.js
 * 輸出：src/assets/data/pokemon.json
 *       src/assets/images/pokemon/
 *       src/assets/images/habitats/
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL    = 'https://pokopiaguide.com';
const LIST_URL    = `${BASE_URL}/zh/pokedex`;
const OUTPUT      = path.resolve(__dirname, '../src/assets/data/pokemon.json');
const IMG_POKE    = path.resolve(__dirname, '../src/assets/images/pokemon');
const IMG_HABITAT = path.resolve(__dirname, '../src/assets/images/habitats');

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

// ── 列表頁：Puppeteer 自動滾動取得全部連結 ──────
async function fetchList() {
  console.log('📋 啟動瀏覽器，抓取完整寶可夢列表...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(headers['User-Agent']);
    await page.goto(LIST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // 持續滾動直到連續 4 次沒有新連結出現
    let prevCount = 0;
    let sameCount = 0;

    while (sameCount < 4) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1500);

      const count = await page.evaluate(() =>
        document.querySelectorAll('a[href^="/zh/pokedex/"]').length
      );
      console.log(`  目前連結數：${count}`);

      if (count === prevCount) {
        sameCount++;
      } else {
        sameCount = 0;
        prevCount = count;
      }
    }

    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="/zh/pokedex/"]')]
        .map((el) => el.getAttribute('href'))
    );

    const items = [];
    hrefs.forEach((href) => {
      const match = href.match(/^\/zh\/pokedex\/([^/]+)$/);
      if (match) items.push({ slug: match[1], detailUrl: `${BASE_URL}${href}` });
    });

    const unique = [...new Map(items.map((i) => [i.slug, i])).values()];
    console.log(`\n  ✅ 共找到 ${unique.length} 隻寶可夢\n`);
    return unique;

  } finally {
    await browser.close();
  }
}

// ── 詳細頁：axios + cheerio ─────────────────────
async function fetchDetail(slug, detailUrl) {
  const res = await axios.get(detailUrl, { headers, timeout: 15000 });
  const $   = cheerio.load(res.data);

  // 編號
  const number = $('span.font-mono').first().text().trim().replace('No.', '');

  // 中文名稱
  const nameChinese = $('h1').first().text().trim();

  // 英文名稱
  const nameEnglish = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // 屬性（只在 hero 區塊內抓，避免抓到相關寶可夢的屬性）
  const typesSet = new Set();
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

  // Pokopia 資訊欄位
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
      const imgUrl  = h.imageUrl.startsWith('http') ? h.imageUrl : `${BASE_URL}${h.imageUrl}`;
      const ext     = imgUrl.split('.').pop().split('?')[0] || 'png';
      imageFile = await downloadImage(imgUrl, IMG_HABITAT, `${h.slug}.${ext}`);
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
  console.log('🚀 Pokopia 寶可夢爬蟲啟動\n');

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(IMG_POKE,    { recursive: true });
  fs.mkdirSync(IMG_HABITAT, { recursive: true });

  // 斷點續爬
  let existing = {};
  if (fs.existsSync(OUTPUT)) {
    const prev = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8'));
    (prev.pokemon || []).forEach((p) => { existing[p.slug] = p; });
    console.log(`📂 已有 ${Object.keys(existing).length} 筆，跳過已爬取的\n`);
  }

  const list   = await fetchList();
  const result = [];
  let success  = 0, failed = 0;

  for (let i = 0; i < list.length; i++) {
    const { slug, detailUrl } = list[i];

    if (existing[slug]) {
      console.log(`[${i + 1}/${list.length}] ↩ 跳過：${slug}`);
      result.push(existing[slug]);
      continue;
    }

    console.log(`[${i + 1}/${list.length}] ⬇ ${slug}`);

    try {
      const data = await fetchDetail(slug, detailUrl);
      result.push(data);
      success++;
      console.log(`  ✓ ${data.nameChinese}(${data.nameEnglish})No.${data.number}`);
    } catch (err) {
      console.warn(`  ✗ 失敗：${err.message}`);
      result.push({ slug, detailUrl, error: err.message });
      failed++;
    }

    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(OUTPUT, JSON.stringify(
        { scraped_at: new Date().toISOString(), total: result.length, pokemon: result },
        null, 2
      ), 'utf-8');
      console.log(`\n  💾 暫存 ${result.length} 筆\n`);
    }

    await sleep(DELAY);
  }

  const output = {
    scraped_at: new Date().toISOString(),
    source:     LIST_URL,
    total:      result.length,
    success,
    failed,
    pokemon:    result,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n✅ 完成！`);
  console.log(`   成功：${success} 失敗：${failed} 總計：${result.length}`);
  console.log(`   JSON:${OUTPUT}`);
  console.log(`   寶可夢圖片：${IMG_POKE}`);
  console.log(`   棲息地圖片：${IMG_HABITAT}`);
}

main().catch(console.error);