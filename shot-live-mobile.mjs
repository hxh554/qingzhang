import { chromium } from 'playwright-core';

import { mkdirSync } from 'node:fs';
mkdirSync('tmp', { recursive: true });

const BASE = process.argv[2] || 'https://hxh554.github.io/qingzhang/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitText(re, timeout = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const t = await p.locator('body').innerText().catch(() => '');
    if (re.test(t)) return true;
    await sleep(500);
  }
  return false;
}

await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(3000);
if (/登录/.test(await p.locator('body').innerText())) {
  const ts = Date.now().toString().slice(-6);
  await p.locator('button:has-text("第一个用")').click();
  await p.locator('input[placeholder*="example.com"]').fill(`qz-shot-${ts}@example.com`);
  await p.locator('input[type=password]').fill('qingzhang123');
  await p.locator('button:has-text("注册并创建账本")').click();
  console.log('注册完成:', await waitText(/本月收支统计/, 60000));
}
await sleep(1500);
await p.screenshot({ path: 'tmp/shot-m-home.png' });

/* 抽屉 */
await p.locator('.nav-toggle').first().click();
await sleep(700);
await p.screenshot({ path: 'tmp/shot-m-drawer.png' });
await p.locator('.nav-mask').click({ position: { x: 370, y: 600 } }).catch(() => {});
await sleep(500);

/* 流水 */
await p.locator('.tab-item:has-text("流水")').click();
await sleep(2500);
await p.screenshot({ path: 'tmp/shot-m-tx.png' });

/* 报表 */
await p.goto(BASE + '#/reports', { waitUntil: 'domcontentloaded' });
await sleep(3500);
await p.screenshot({ path: 'tmp/shot-m-reports.png' });

/* 项目管理（表格页） */
await p.goto(BASE + '#/projects', { waitUntil: 'domcontentloaded' });
await sleep(3000);
await p.screenshot({ path: 'tmp/shot-m-projects.png' });
const ovf = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('projects 横向溢出:', ovf);

console.log(errs.length ? '错误: ' + errs.join(' | ') : '无JS错误 ✓');
await browser.close();
