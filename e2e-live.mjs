import { chromium } from 'playwright-core';

import { mkdirSync } from 'node:fs';
mkdirSync('tmp', { recursive: true });

const BASE = 'https://hxh554.github.io/qingzhang/';
const ts = Date.now().toString().slice(-6);
const EMAIL = `qz-live-${ts}@example.com`;
const PW = 'qingzhang123';
const log = (...a) => console.log(...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const p = await ctx.newPage();
p.on('dialog', d => d.accept());
p.on('pageerror', e => log('[PAGEERROR]', e.message));
p.on('response', async r => {
  if (!/supabase\.co/.test(r.url())) return;
  if (r.status() >= 400) log(`[HTTP ${r.status()}]`, r.url().replace(/^https:\/\/[^/]+/, '').slice(0, 100));
});

async function waitText(re, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = await p.locator('body').innerText().catch(() => '');
    if (re.test(t)) return true;
    await sleep(1000);
  }
  return false;
}

log('== 打开线上站点', BASE);
await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(3000);
const body1 = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
log('页面文本:', body1.slice(0, 120));
const isLogin = /登录/.test(body1);
log('云端模式登录页:', isLogin ? 'OK' : 'FAIL（可能是纯本地版）');
if (!isLogin) process.exit(1);
await p.screenshot({ path: 'tmp/live-1-login.png' });

log('== 注册', EMAIL);
await p.locator('button:has-text("第一个用")').click();
await p.locator('input[placeholder*="example.com"]').fill(EMAIL);
await p.locator('input[type=password]').fill(PW);
const t0 = Date.now();
await p.locator('button:has-text("注册并创建账本")').click();
const ok = await waitText(/本月收支统计/);
log(`注册并进入首页: ${ok ? 'OK' : 'FAIL'} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
if (!ok) { log('  文本:', (await p.locator('body').innerText()).slice(0, 300).replace(/\n/g, ' | ')); process.exit(1); }
await p.screenshot({ path: 'tmp/live-2-home.png' });

log('== 记一笔 66.66');
await p.locator('button:has-text("记一笔")').first().click();
await p.waitForTimeout(800);
await p.locator('.modal input.input-lg').fill('66.66');
await p.waitForTimeout(400);
await p.locator('.modal .cat-cell').nth(1).click();
await p.locator('.modal button:has-text("保存")').click();
const seen = await waitText(/66\.66/, 30000);
log(`流水出现 66.66: ${seen ? 'OK' : 'FAIL'}`);
await p.screenshot({ path: 'tmp/live-3-tx.png' });

log('== 刷新页面验证云端持久化');
await p.goto('about:blank');
await p.goto(BASE + '#/tx', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(4000);
const t2 = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
log('刷新后流水页含 66.66:', t2.includes('66.66') ? 'OK（云端有这条数据）' : 'FAIL');
await p.screenshot({ path: 'tmp/live-4-refresh.png' });

log('DONE', EMAIL);
await browser.close();
