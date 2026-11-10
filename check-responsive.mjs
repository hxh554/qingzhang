import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:5199/';
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function shoot(w, h, tag, routes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  for (const [route, name] of routes) {
    await p.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `ui-${tag}-${name}.png` });
  }
  if (errs.length) console.log(`[${tag}] 页面错误:`, errs.join(' | '));
  return { ctx, p };
}

const routes = [
  ['/', 'home'],
  ['/#/tx', 'tx'],
  ['/#/projects', 'projects'],
  ['/#/accounts', 'accounts'],
];

const m = await shoot(390, 844, 'm', routes);

/* 手机端抽屉检测 */
const p = m.p;
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(800);
const before = await p.evaluate(() => {
  const sb = document.querySelector('.sidebar');
  const tb = document.querySelector('.tabbar');
  return {
    sidebarLeft: getComputedStyle(sb).transform,
    tabbarDisplay: getComputedStyle(tb).display,
    sidebarFixed: getComputedStyle(sb).position,
  };
});
console.log('手机端初始:', JSON.stringify(before));

await p.locator('.nav-toggle').click();
await p.waitForTimeout(500);
const after = await p.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).transform);
console.log('点汉堡后 sidebar transform:', after);
await p.screenshot({ path: 'ui-m-drawer.png' });

/* 点遮罩关闭 */
await p.locator('.nav-mask').click({ position: { x: 360, y: 500 } });
await p.waitForTimeout(400);
console.log('遮罩关闭后:', await p.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).transform));

/* 底部 tab 跳转 */
await p.locator('.tab-item:has-text("流水")').click();
await p.waitForTimeout(800);
console.log('点底部「流水」后 URL:', p.url());

/* 记一笔弹窗在手机上的样子 */
await p.locator('.tab-add').click();
await p.waitForTimeout(700);
await p.screenshot({ path: 'ui-m-add.png' });
const modalBox = await p.locator('.modal').boundingBox();
console.log('弹窗尺寸:', JSON.stringify(modalBox));
await p.keyboard.press('Escape');

await shoot(1440, 900, 'pc', routes);
await browser.close();
