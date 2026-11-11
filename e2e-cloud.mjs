import { chromium } from 'playwright-core';

import { mkdirSync } from 'node:fs';
mkdirSync('tmp', { recursive: true });

const BASE = 'http://127.0.0.1:5199';
const ts = Date.now().toString().slice(-6);
const EMAIL_A = `qz-a-${ts}@example.com`;
const EMAIL_B = `qz-b-${ts}@example.com`;
const PW = 'qingzhang123';
const log = (...a) => console.log(...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function newPage(label) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  p.on('pageerror', e => log(`  [${label} PAGEERROR]`, e.message));
  p.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/favicon/.test(m.text())) log(`  [${label} ${m.type()}]`, m.text().slice(0, 200)); });
  p.on('response', async r => {
    const u = r.url();
    if (!/supabase\.co/.test(u)) return;
    const path = u.replace(/^https:\/\/[^/]+/, '');
    if (r.status() >= 400) log(`  [${label} HTTP ${r.status()}]`, path.slice(0, 120), (await r.text().catch(() => '')).slice(0, 160));
  });
  return { ctx, p };
}

/** 轮询等待页面出现某段文字 */
async function waitText(p, re, ms = 45000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = await p.locator('body').innerText().catch(() => '');
    if (re.test(t)) return true;
    await sleep(1000);
  }
  return false;
}

async function signup(p, email) {
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  if (await p.locator('button:has-text("第一个用")').count()) await p.locator('button:has-text("第一个用")').click();
  await p.locator('input[placeholder*="example.com"]').fill(email);
  await p.locator('input[type=password]').fill(PW);
  await p.locator('button:has-text("注册并创建账本")').click();
}

/* ---------- A ---------- */
const A = await newPage('A');
log('== A 注册', EMAIL_A);
const ta = Date.now();
await signup(A.p, EMAIL_A);
const aOk = await waitText(A.p, /本月收支统计/);
log(`A 进入首页: ${aOk ? 'OK' : 'FAIL'} (${((Date.now() - ta) / 1000).toFixed(1)}s)`);
if (!aOk) log('  A 文本:', (await A.p.locator('body').innerText()).slice(0, 260).replace(/\n/g, ' | '));

await A.p.goto('about:blank');
await A.p.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
await A.p.waitForTimeout(2000);
const setText = await A.p.locator('body').innerText();
log('A 云端面板:', /云端同步/.test(setText) ? 'OK' : 'FAIL', '|', (setText.match(/(已连接|离线)[^\n]*/) ?? ['无'])[0]);
await A.p.screenshot({ path: 'tmp/e2e-2-A-settings.png' });

await A.p.locator('button:has-text("生成邀请码")').click();
let code = null;
for (let i = 0; i < 30; i++) {
  await A.p.waitForTimeout(1000);
  code = await A.p.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find(s => {
      const t = (s.textContent || '').trim();
      return /^[A-Z0-9]{6}$/.test(t) && parseFloat(getComputedStyle(s).fontSize) >= 18;
    });
    return el ? el.textContent.trim() : null;
  });
  if (code) break;
}
log('邀请码:', code ?? 'FAIL');
if (!code) log('  云端卡片:', (await A.p.locator('.card').nth(1).innerText().catch(() => '')).replace(/\n/g, ' / ').slice(0, 300));
await A.p.screenshot({ path: 'tmp/e2e-3-A-invite.png' });

/* ---------- B ---------- */
const B = await newPage('B');
log('== B 注册', EMAIL_B);
const tb = Date.now();
await signup(B.p, EMAIL_B);
const bOk = await waitText(B.p, /本月收支统计/);
log(`B 进入首页: ${bOk ? 'OK' : 'FAIL'} (${((Date.now() - tb) / 1000).toFixed(1)}s)`);
await B.p.screenshot({ path: 'tmp/e2e-4-B-home.png' });

if (code) {
  await B.p.goto('about:blank');
  await B.p.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
  await B.p.waitForTimeout(2000);
  await B.p.locator('input[placeholder*="邀请码"]').fill(code);
  await B.p.locator('button:has-text("加入")').click();
  const joined = await waitText(B.p, /本月收支统计/, 40000);
  const bt = await B.p.locator('body').innerText();
  log('B 加入后进首页:', joined ? 'OK' : 'CHECK');
  log('B 页面金额样本:', (bt.match(/[\d,]+\.\d{2}/g) ?? []).slice(0, 4).join(' / ') || '无');
  await B.p.screenshot({ path: 'tmp/e2e-5-B-joined.png' });
}

/* ---------- A 记一笔 → 看 B 是否同步收到 ---------- */
await B.p.goto('about:blank');
await B.p.goto(BASE + '/#/tx', { waitUntil: 'networkidle' });
await B.p.waitForTimeout(2500);

await A.p.goto('about:blank');
await A.p.goto(BASE + '/', { waitUntil: 'networkidle' });
await A.p.waitForTimeout(2500);
await A.p.locator('button:has-text("记一笔")').first().click();
await A.p.waitForTimeout(600);
await A.p.locator('.modal input.input-lg').fill('88.88');
await A.p.locator('.modal .cat-cell').nth(1).click();
await A.p.locator('.modal button:has-text("保存")').click();
await A.p.waitForTimeout(2000);
log('A 已记 88.88');

const t0 = Date.now();
const seen = await waitText(B.p, /88\.88/, 40000);
log(`B 收到 88.88: ${seen ? 'OK' : 'FAIL'} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
if (!seen) {
  await B.p.goto('about:blank');
  await B.p.goto(BASE + '/#/tx', { waitUntil: 'networkidle' });
  await sleep(5000);
  const t = await B.p.locator('body').innerText();
  log('  刷新后列表里有 88.88:', t.includes('88.88') ? '有（只是推送慢）' : '没有（同步失败）');
}
await B.p.screenshot({ path: 'tmp/e2e-6-B-synced.png' });

await browser.close();
log('\nDONE', EMAIL_A, EMAIL_B, 'code', code);
