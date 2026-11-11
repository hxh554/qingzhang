import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

/* 无论从哪里调用，都切回项目根目录执行：截图等临时产出统一写进 tmp/ */
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
mkdirSync("tmp", { recursive: true });

mkdirSync('public', { recursive: true });

const P = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
<g stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="M6 5.5 L16 16.5 L26 5.5"/>
<path d="M16 16.5 V26.5"/>
<path d="M9 18.4 H23"/>
<path d="M9 22.8 H23"/>
</g>
</svg>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function shot(size, ratio, out) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const inner = Math.round(size * ratio);
  await p.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;background:#FF8A3D;display:flex;align-items:center;justify-content:center;overflow:hidden">
      ${P.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}
    </body>`
  );
  await p.waitForTimeout(150);
  await p.screenshot({ path: out });
  await ctx.close();
  console.log('生成', out, `${size}x${size} 符号占比 ${(ratio * 0.62 * 100).toFixed(0)}%`);
}

await shot(192, 0.95, 'public/icon-192.png');
await shot(512, 0.95, 'public/icon-512.png');
await shot(512, 0.78, 'public/icon-maskable-512.png');
await shot(180, 0.95, 'public/apple-touch-icon.png');
await browser.close();
