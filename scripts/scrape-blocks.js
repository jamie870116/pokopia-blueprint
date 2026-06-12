/**
 * Pokopia Blocks Scraper
 * Run:    node scripts/scrape-blocks.js
 * Output: src/assets/data/blocks.json
 *         public/images/blocks/item-{id}.png
 *
 * Scrapes the "方塊" (Blocks) category from pokopiaguide.com:
 * Chinese name from /zh/items, English name from /en/items (matched by
 * item image id), downloads thumbnails, and computes a dominant color
 * per image for the 2D/3D renderers.
 */

import axios from 'axios';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT    = path.resolve(__dirname, '../src/assets/data/blocks.json');
const IMG_DIR   = path.resolve(__dirname, '../public/images/blocks');

const DELAY = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
};

async function downloadImage(url, filename) {
  const filepath = path.join(IMG_DIR, filename);
  if (fs.existsSync(filepath)) return true;
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', headers, timeout: 10000 });
    fs.writeFileSync(filepath, res.data);
    console.log(`    ✓ 圖片：${filename}`);
    return true;
  } catch (err) {
    console.warn(`    ✗ 圖片失敗：${filename} — ${err.message}`);
    return false;
  }
}

// Open the items page at the given URL, click the Blocks category,
// scroll until the card count is stable, and collect {itemId, name, tags}.
// Only cards whose category badge matches `badge` are kept (the page can
// render unrelated cards outside the filtered grid).
async function fetchBlockList(page, url, buttonPrefix, badge) {
  console.log(`📋 抓取方塊列表：${url}`);
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 45000,
  });
  await sleep(2000);

  const clicked = await page.evaluate((prefix) => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent.trim().startsWith(prefix)
    );
    if (btn) btn.click();
    return Boolean(btn);
  }, buttonPrefix);
  if (!clicked) throw new Error(`找不到「${buttonPrefix}」分類按鈕（${url}）`);
  await sleep(2000);

  let prevCount = 0;
  let sameCount = 0;
  while (sameCount < 3) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000);
    const count = await page.evaluate(
      () => document.querySelectorAll('img[src*="/images/items/item-"]').length
    );
    if (count === prevCount) sameCount++;
    else {
      sameCount = 0;
      prevCount = count;
    }
  }

  const items = await page.evaluate((badgeText) => {
    const out = [];
    document.querySelectorAll('img[src*="/images/items/item-"]').forEach((img) => {
      const m = img.getAttribute('src').match(/item-(\d+)\.png/);
      if (!m) return;
      // The card root holds the <h3> name and the badge tags
      let card = img;
      for (let i = 0; i < 6 && card.parentElement; i++) {
        card = card.parentElement;
        if (card.querySelector('h3')) break;
      }
      const name = card.querySelector('h3')?.textContent.trim() ?? img.getAttribute('alt') ?? '';
      const tags = [...card.querySelectorAll('span')]
        .map((s) => s.textContent.trim())
        .filter(Boolean);
      if (!tags.some((t) => t === badgeText)) return;
      out.push({ itemId: Number(m[1]), name, tags });
    });
    return out;
  }, badge);

  const unique = [...new Map(items.map((i) => [i.itemId, i])).values()];
  console.log(`  ✅ ${unique.length} 筆\n`);
  return unique;
}

// Compute a dominant color per downloaded image inside the browser
// (canvas), using opaque-pixel averaging weighted toward the most
// common quantized bucket so transparent PNG edges don't wash it out.
async function computeColors(page, files) {
  console.log('🎨 計算主色...');
  const entries = files.map((f) => ({
    file: f,
    dataUrl: `data:image/png;base64,${fs.readFileSync(path.join(IMG_DIR, f)).toString('base64')}`,
  }));

  return page.evaluate(async (list) => {
    const result = {};
    for (const { file, dataUrl } of list) {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = dataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const W = canvas.width;
      const H = canvas.height;

      // Thumbnails have an opaque light-gray backdrop; sample the four
      // corners to detect it so it can be excluded from the color vote.
      const corner = (x, y) => {
        const i = (y * W + x) * 4;
        return [data[i], data[i + 1], data[i + 2]];
      };
      const corners = [corner(1, 1), corner(W - 2, 1), corner(1, H - 2), corner(W - 2, H - 2)];
      const isBackground = (r, g, b) =>
        corners.some(([cr, cg, cb]) => Math.abs(r - cr) + Math.abs(g - cg) + Math.abs(b - cb) < 60);

      // Quantize remaining opaque pixels into 32-level buckets, find the
      // most common bucket, then average the true colors inside it.
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        if (isBackground(data[i], data[i + 1], data[i + 2])) continue;
        const key = `${data[i] >> 5},${data[i + 1] >> 5},${data[i + 2] >> 5}`;
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = { n: 0, r: 0, g: 0, b: 0 }));
        b.n++;
        b.r += data[i];
        b.g += data[i + 1];
        b.b += data[i + 2];
      }
      let best = null;
      buckets.forEach((b) => {
        if (!best || b.n > best.n) best = b;
      });
      if (best) {
        const hex = (c) => Math.round(c).toString(16).padStart(2, '0');
        result[file] = `#${hex(best.r / best.n)}${hex(best.g / best.n)}${hex(best.b / best.n)}`;
      } else {
        result[file] = '#888888';
      }
    }
    return result;
  }, entries);
}

async function main() {
  console.log('🚀 Pokopia 方塊爬蟲啟動\n');
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(IMG_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(headers['User-Agent']);

    const zhList = await fetchBlockList(page, 'https://pokopiaguide.com/zh/items', '方塊', '方塊');
    let enMap = new Map();
    try {
      // Default locale (English) lives at /items without a prefix
      const enList = await fetchBlockList(page, 'https://pokopiaguide.com/items', 'Block', 'Block');
      enMap = new Map(enList.map((i) => [i.itemId, i.name]));
    } catch (err) {
      console.warn(`  ⚠ 英文名抓取失敗（保留空值）：${err.message}\n`);
    }

    // Download images
    console.log('⬇ 下載圖片...');
    const downloaded = new Set();
    for (const item of zhList) {
      const filename = `item-${item.itemId}.png`;
      const ok = await downloadImage(
        `https://pokopiaguide.com/images/items/item-${item.itemId}.png`,
        filename
      );
      if (ok) downloaded.add(filename);
      await sleep(DELAY / 4);
    }

    const colors = await computeColors(page, [...downloaded]);

    const blocks = zhList
      .map((item) => {
        const image = `item-${item.itemId}.png`;
        const color = colors[image] ?? '#888888';
        return {
          id: `blk-${item.itemId}`,
          itemId: item.itemId,
          name: enMap.get(item.itemId) ?? '',
          nameChinese: item.name,
          colorable: item.tags.some((t) => t.includes('可上色')),
          image: downloaded.has(image) ? image : null,
          color,
          hex: parseInt(color.slice(1), 16),
        };
      })
      .sort((a, b) => a.itemId - b.itemId);

    const output = {
      scraped_at: new Date().toISOString(),
      source: 'https://pokopiaguide.com/zh/items（方塊分類）',
      total: blocks.length,
      blocks,
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`\n✅ 完成！共 ${blocks.length} 筆`);
    console.log(`   JSON：${OUTPUT}`);
    console.log(`   圖片：${IMG_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
