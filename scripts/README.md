# scripts/ —— 测试与构建辅助脚本

这里的文件**不影响线上运行**，只是开发时用来检查"改完还能不能用"。全部是 Node 脚本，通过 `playwright-core` 驱动本机已安装的 Chrome（不下载额外浏览器）。

所有脚本都会自动切回项目根目录执行，**截图等临时产出统一写入 `tmp/`**（该目录已在 `.gitignore` 里，随时可整体删除）。

## 一、回归测试（改完代码先跑这个）

| 脚本 | 干什么 | 怎么跑 |
|---|---|---|
| `verify.mjs` | **主力回归**：跑 14 个路由，检查记账写入回显、月份选择器、分享链接导入、加入账本 | 先 `npm run dev`（或 preview 在 5199 端口），再 `node scripts/verify.mjs` |
| `check-pwa.mjs` | 检查 manifest、Service Worker 是否激活、4 个图标是否 200、theme-color | `node scripts/check-pwa.mjs [url]`，默认 `http://127.0.0.1:5199/` |
| `check-offline.mjs` | 断网后刷新还能不能打开（验证 SW 缓存策略） | `node scripts/check-offline.mjs [url]` |
| `check-responsive.mjs` | 手机视口布局：抽屉开合、底部 Tab、贴底弹窗、横向溢出 | 同上，需本地服务在线 |

## 二、线上环境验证（部署后跑）

| 脚本 | 干什么 |
|---|---|
| `e2e-live.mjs` | 在真实站点注册 → 记一笔 66.66 → 刷新确认数据还在（验证 Supabase 往返） |
| `e2e-cloud.mjs` | 双账号云同步：A 记账 → B 是否秒收（验证 realtime / 轮询兜底） |
| `check-live-mobile.mjs` | 线上手机视口：汉堡菜单、底部 tab、弹窗尺寸、溢出检查（**会自动注册测试账号**） |
| `shot-live-mobile.mjs` | 线上批量截图（首页/抽屉/流水/报表/项目），存 `tmp/`（**会自动注册测试账号**） |

> 用法：`node scripts/e2e-live.mjs`、`node scripts/check-live-mobile.mjs https://hxh554.github.io/qingzhang/`
> 注意：跑线上脚本会在 Supabase 里留下测试账号，攒多了在 SQL Editor 执行
> `delete from auth.users; delete from public.books;` 清理。

## 三、资源生成

| 脚本 | 干什么 |
|---|---|
| `make-icons.mjs` | 用无头浏览器渲染 ¥ 图标，输出 `public/icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、`apple-touch-icon.png` |

改了图标配色或形状才需要重跑：`node scripts/make-icons.mjs`（会覆盖 `public/` 下的同名文件）。

## 说明

- 脚本依赖 `node_modules` 里的 `playwright-core`，所以要先把依赖装好
- 本机如果 `npm` 命令被拦截（走 WSL 包装器），构建用 `node node_modules/vite/bin/vite.js build`，脚本用 `node scripts/xxx.mjs` 一样能跑
- 这些脚本**不参与** GitHub Actions 构建，删掉任何一个都不影响线上
