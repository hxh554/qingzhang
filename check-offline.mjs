import { chromium } from 'playwright-core';

import { mkdirSync } from 'node:fs';
mkdirSync('tmp', { recursive: true });

const BASE = process.argv[2] || 'http://127.0.0.1:5199/';
console.log('检测地址:', BASE);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
const p = await ctx.newPage();

const bad = [];
p.on('console', m => { if (m.type() === 'error') bad.push(m.text().slice(0, 140)); });

await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(3000);
await p.evaluate(() => navigator.serviceWorker.ready);
const cached = await p.evaluate(async () => {
  const out = {};
  for (const k of await caches.keys()) {
    const c = await caches.open(k);
    out[k] = (await c.keys()).length;
  }
  return out;
});
console.log('缓存条目数:', JSON.stringify(cached));

await ctx.setOffline(true);
console.log('已切离线，reload…');
try {
  const r = await p.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
  console.log('响应状态:', r ? r.status() : 'null');
} catch (e) {
  console.log('reload 抛错:', e.message.slice(0, 100));
}
await p.waitForTimeout(3000);

const txt = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
console.log('离线页面文本:', txt.slice(0, 90) || '(空)');
console.log('离线可打开:', txt.length > 10 ? 'OK' : 'FAIL');
console.log('控制台错误:', bad.length ? bad.join(' | ') : '无');
await p.screenshot({ path: 'tmp/pwa-offline.png' });
await browser.close();
