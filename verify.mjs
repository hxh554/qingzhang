import { chromium } from 'playwright-core';

const BASE = 'http://127.0.0.1:5199';

const routes = [
  ['/', '首页'],
  ['/#/tx', '流水'],
  ['/#/reports/base', '报表-基础'],
  ['/#/reports/category', '报表-分类'],
  ['/#/reports/account', '报表-账户'],
  ['/#/reports/member', '报表-成员'],
  ['/#/reports/project', '报表-项目'],
  ['/#/reports/merchant', '报表-商家'],
  ['/#/categories', '收支分类'],
  ['/#/accounts', '账户管理'],
  ['/#/members', '成员管理'],
  ['/#/merchants', '商家管理'],
  ['/#/projects', '项目管理'],
  ['/#/settings', '设置'],
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

let failed = 0;
for (const [route, label] of routes) {
  errors = [];
  await page.goto('about:blank');
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const text = (await page.locator('body').innerText()).replace(/\s/g, '');
  const canvas = await page.locator('canvas').count();
  const ok = text.length > 80 && errors.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(10)} text=${String(text.length).padEnd(5)} canvas=${canvas} ${errors.length ? 'ERR: ' + errors.slice(0, 2).join(' | ') : ''}`);
}

await page.goto('about:blank');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const homeText = await page.locator('body').innerText();
console.log('\n首页数字样本:', (homeText.match(/[\d,]+\.\d{2}/g) ?? []).slice(0, 8).join(' / '));
console.log('含 NaN:', /NaN/.test(homeText));
await page.screenshot({ path: 'shot-home.png' });

await page.locator('button:has-text("记一笔")').first().click();
await page.waitForTimeout(400);
await page.locator('.modal input.input-lg').fill('35+20');
await page.locator('.modal .cat-cell').nth(1).click();
await page.locator('.modal button:has-text("保存")').click();
await page.waitForTimeout(600);
const tip = /已记一笔/.test(await page.locator('body').innerText());
await page.keyboard.press('Escape');
console.log('连续记账提示:', tip ? 'OK' : 'FAIL');

await page.goto('about:blank');
await page.goto(BASE + '/#/tx', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const txText = await page.locator('body').innerText();
console.log('新增流水 55.00 出现在列表:', txText.includes('55.00') ? 'OK' : 'FAIL');
await page.screenshot({ path: 'shot-tx.png' });

await page.goto('about:blank');
await page.goto(BASE + '/#/reports/base', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const repText = await page.locator('body').innerText();
console.log('报表出现「未分类」:', repText.includes('未分类') ? 'FAIL' : 'OK');
console.log('报表出现空尖峰提示:', repText.includes('暂无数据') ? '含暂无数据(可接受)' : 'OK');
await page.screenshot({ path: 'shot-report.png' });

await page.goto('about:blank');
await page.goto(BASE + '/#/reports/category', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shot-category.png' });

await page.goto('about:blank');
await page.goto(BASE + '/#/categories', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'shot-cat.png' });

/* 脏数据自愈测试：清标记 + 制造有账本无流水的状态 */
await page.evaluate(async () => {
  localStorage.removeItem('qz_seed_v5');
  await new Promise(r => { const req = indexedDB.deleteDatabase('qingzhang'); req.onsuccess = r; req.onerror = r; req.onblocked = r; });
});
await page.goto('about:blank');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const again = await page.locator('body').innerText();
console.log('清库后重新初始化有数据:', /[\d,]+\.\d{2}/.test(again) && !/^\s*0\.00/.test(again) ? 'OK' : 'CHECK');

/* ===== 月份选择器 ===== */
await page.goto('about:blank');
await page.goto(BASE + '/#/reports/base', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('.month-nav .cur').click();
await page.waitForTimeout(300);
const gridCount = await page.locator('.month-panel .month-grid button').count();
const panelShown = await page.locator('.month-panel').isVisible();
await page.screenshot({ path: 'shot-picker.png' });
await page.locator('.month-panel .month-grid button').nth(2).click();
await page.waitForTimeout(700);
const curText = (await page.locator('.month-nav .cur').innerText()).replace(/\s/g, '');
const panelClosed = !(await page.locator('.month-panel').isVisible());
console.log(`月份选择器：面板=${panelShown ? 'OK' : 'FAIL'} 月份数=${gridCount} 选中=${curText} 关闭=${panelClosed ? 'OK' : 'FAIL'}`);

/* ===== 分享账本链接 / 分享码 ===== */
await page.goto('about:blank');
await page.goto(BASE + '/#/members', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('button:has-text("分享账本")').click();
await page.waitForTimeout(1500);
const shareLink = await page.locator('.modal input.input').first().inputValue();
const shareCode = await page.locator('.modal textarea').first().inputValue();
await page.screenshot({ path: 'shot-share.png' });
console.log(`分享：链接${/#\/join\/./.test(shareLink) ? 'OK' : 'FAIL'} 长度=${shareLink.length} 分享码长度=${shareCode.length}`);

/* ===== 对方打开链接 → 导入（全新浏览器上下文，模拟另一台设备） ===== */
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await ctx2.newPage();
const errs2 = [];
p2.on('pageerror', e => errs2.push(e.message));
p2.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs2.push(m.text()); });
await p2.goto(shareLink, { waitUntil: 'networkidle' });
await p2.waitForTimeout(1800);
const joinText = (await p2.locator('body').innerText()).replace(/\s/g, '');
await p2.screenshot({ path: 'shot-join.png' });
console.log(`对方打开链接：识别=${/邀你查看账本/.test(joinText) ? 'OK' : 'FAIL'} 摘要=${(joinText.match(/\d+笔流水·\d+位成员/) ?? ['无'])[0]}`);

const importBtn = p2.locator('button:has-text("导入到本机")');
const hasImport = await importBtn.count();
if (hasImport) {
  await importBtn.click();
  await p2.waitForTimeout(2200);
  const afterText = await p2.locator('body').innerText();
  const landedHome = !/#\/join/.test(p2.url());
  console.log(`导入后：跳转=${landedHome ? 'OK' : 'FAIL'} 有金额=${/[\d,]+\.\d{2}/.test(afterText) ? 'OK' : 'FAIL'} NaN=${/NaN/.test(afterText) ? 'FAIL' : 'OK'} 报错=${errs2.length ? errs2.slice(0, 2).join(' | ') : '无'}`);
  await p2.screenshot({ path: 'shot-after-join.png' });
} else {
  console.log('导入后：按钮缺失 FAIL');
}
await ctx2.close();

console.log(`\n总览：${routes.length - failed}/${routes.length} 页面通过`);
await browser.close();
