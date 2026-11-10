import { chromium } from 'playwright-core';

/* 用法: node check-live-mobile.mjs https://hxh554.github.io/qingzhang/ */
const BASE = process.argv[2] || 'http://127.0.0.1:5199/';
console.log('目标站点:', BASE);
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await mctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));

await p.goto(BASE, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);

/* 未登录则先注册测试账号 */
const body0 = await p.locator('body').innerText();
if (/登录/.test(body0)) {
  console.log('登录页 → 注册测试账号');
  const ts = Date.now().toString().slice(-6);
  await p.locator('button:has-text("第一个用")').click();
  await p.locator('input[placeholder*="example.com"]').fill(`qz-mob-${ts}@example.com`);
  await p.locator('input[type=password]').fill('qingzhang123');
  await p.locator('button:has-text("注册并创建账本")').click();
  await p.waitForTimeout(4000);
}

const before = await p.evaluate(() => {
  const sb = document.querySelector('.sidebar');
  const tb = document.querySelector('.tabbar');
  return {
    sidebarFixed: sb ? getComputedStyle(sb).position : '无.sidebar',
    tabbarDisplay: tb ? getComputedStyle(tb).display : '无.tabbar',
  };
});
console.log('手机端初始:', JSON.stringify(before));

/* 汉堡按钮 → 抽屉 */
await p.locator('.nav-toggle').first().click();
await p.waitForTimeout(600);
const after = await p.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).transform);
console.log('点汉堡后 sidebar transform:', after);
await p.screenshot({ path: 'live-m-drawer.png' });

/* 遮罩关闭 */
await p.locator('.nav-mask').click({ position: { x: 360, y: 500 } }).catch(() => {});
await p.waitForTimeout(400);
console.log('遮罩关闭后 transform:', await p.evaluate(() => getComputedStyle(document.querySelector('.sidebar')).transform));

/* 底部 tab 跳转 */
await p.locator('.tab-item:has-text("流水")').click().catch(async e => { console.log('tab点击失败:', e.message); });
await p.waitForTimeout(1000);
console.log('点底部「流水」后 URL:', p.url());

/* ⊕ 记一笔 → 贴底弹窗 */
await p.locator('.tab-add').click().catch(e => console.log('tab-add点击失败:', e.message));
await p.waitForTimeout(800);
await p.screenshot({ path: 'live-m-add.png' });
const modal = await p.locator('.modal').boundingBox();
console.log('弹窗尺寸:', JSON.stringify(modal));
await p.keyboard.press('Escape');

/* 横向溢出检查 */
await p.goto(BASE + '/#/tx', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('流水页横向溢出(px):', overflow);
await p.screenshot({ path: 'live-m-tx.png' });

await p.goto(BASE + '/#/projects', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1200);
await p.screenshot({ path: 'live-m-projects.png' });

if (errs.length) console.log('页面JS错误:', errs.join(' | '));
else console.log('无页面JS错误 ✓');
await browser.close();
