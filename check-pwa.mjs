import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://127.0.0.1:5199/';
const log = (...a) => console.log(...a);

log('检测地址:', BASE);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));

await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(3500);

const mf = await p.evaluate(async () => {
  const link = document.querySelector('link[rel=manifest]');
  if (!link) return { ok: false, why: '没有 manifest link' };
  const r = await fetch(link.href);
  const j = await r.json();
  return { ok: true, status: r.status, name: j.name, short: j.short_name, display: j.display, icons: j.icons.length, start: j.start_url, scope: j.scope };
});
log('manifest:', JSON.stringify(mf));

const sw = await p.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return '不支持';
  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length) return 'active: ' + (regs[0].active ? regs[0].active.state : 'installing') + ' scope=' + regs[0].scope;
  const r = await navigator.serviceWorker.ready.catch(() => null);
  return r ? 'ready' : '未注册';
});
log('service worker:', sw);

for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'sw.js', 'manifest.webmanifest']) {
  const r = await p.request.get(BASE + f);
  log(`  ${f.padEnd(26)} ${r.status()} ${r.headers()['content-type'] || ''}`);
}

const theme = await p.evaluate(() => document.querySelector('meta[name=theme-color]')?.content);
const appleIcon = await p.evaluate(() => document.querySelector('link[rel=apple-touch-icon]')?.href);
log('theme-color:', theme, '| apple-touch-icon:', appleIcon ? 'OK' : '缺失');
log('页面错误:', errs.length ? errs.join(' | ') : '无');
await p.screenshot({ path: 'pwa-mobile.png' });
await browser.close();
