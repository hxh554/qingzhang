# 轻账 · 本地优先记账

参考随手记「神象云账本」做的个人/家庭记账应用。React 18 + TypeScript + Vite 5，数据存在浏览器 IndexedDB（Dexie），**没有服务端**。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5199
npm run build    # 产物在 dist/
npm run preview  # 预览构建产物
```

## 部署到 GitHub Pages

> 前提：把这个 `qingzhang` 目录作为**仓库根目录**推送（`.github/workflows/deploy.yml` 必须位于仓库根）。

1. 在 GitHub 新建仓库（Public 免费；Private 需要 Pro 才能用 Pages）——**不要勾 Add a README / .gitignore / license**，否则远端先有提交会跟你本地打架
2. 推送代码（默认分支用 `main`；仓库已经 `git init` + 提交过，直接加远端推送即可）：
   ```bash
   git remote add origin https://github.com/hxh554/qingzhang.git
   git branch -M main
   git push -u origin main
   ```
   > `.env` 已被 `.gitignore` 排除，不会被推上去；构建时用的云端参数直接写在 workflow 里。
3. 仓库 → **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**
4. 等 Actions 跑完（约 1 分钟），地址是 `https://<用户名>.github.io/<仓库名>/`

工程里已经做了两件必要的事：`vite.config.ts` 的 `base: './'`（子路径也能加载资源）、hash 路由（刷新不会 404），所以推上去就能开。

> 国内网络访问 `github.io` 经常很慢甚至打不开。要稳定给家人用，建议国内静态托管：阿里云 OSS / 腾讯云 COS 的「静态网站托管」+ 已备案域名。

## 两种运行模式

| 模式 | 触发条件 | 数据在哪 | 家人能否实时共享 |
|---|---|---|---|
| **纯本地** | 没有 `.env` | 各自浏览器 IndexedDB | 不能，只能靠「分享账本」手动同步快照 |
| **云端同步** | 配了 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase（Postgres），本机只做缓存 | 能，同一本账多人实时可见 |

代码是一套：没配云端就自动退化成纯本地，页面行为完全不变。

## 启用云端同步（Supabase 免费版够家用）

1. 注册 https://supabase.com → New project（区域建议 Singapore / Tokyo）
2. 打开 **SQL Editor**，整段粘贴 `supabase/schema.sql` → Run（建表 + 权限策略 + 实时推送 + 邀请码函数）
3. **Authentication → Providers → Email**：关掉 `Confirm email`（自用省掉收验证邮件）
4. **Project Settings → API**：复制 `Project URL` 和 `anon public` key，本地建 `.env`：
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
5. 部署到 GitHub Pages **不需要再配 Secrets**：云端参数已直接写在 `.github/workflows/deploy.yml` 的构建环境里（publishable key 本来就会打进前端 JS，靠 RLS 保护数据，不是秘密）。换 Supabase 项目时改那两行即可

### 用法

- 第一个人注册 → 自动创建云端账本（先清空本机演示数据再登录也行）。若本机已有想保留的流水，用 **设置 → 云端同步 → 上传本机流水** 手动推一次（首次登录不会自动灌演示数据，避免云端被示例数据污染）
- 家人注册后，在 **设置 → 云端同步 → 加入家人的账本** 输入 6 位邀请码（24 小时有效），即可看到同一本账
- 同一账号在手机/电脑同时登录，也是同一本账
- 记账后本机立即生效，后台异步推送云端；对方通过 realtime 秒级收到。断网时进队列，恢复后自动重推
- **国内网络提示**：Supabase 的 WebSocket（realtime）在国内常被掐断，所以额外加了「12 秒轮询兜底」——断线时改数据也能同步，只是慢十几秒。手机端切回前台会立即拉一次

### 安全说明

`anon` key 是公开的、必须放进前端，这是 Supabase 的设计。数据隔离完全靠 `schema.sql` 里的 RLS 策略：用户只能读写自己 `book_members` 里的账本。**不要把 `service_role` key 放进前端。**

### 还想纯本地分享？

「分享账本」仍然保留：把账本打成快照（`.qzbook` 文件 / 分享码 / 链接）给对方导入，适合一次性给账、不想开账号的场景。注意它是快照，不会自动同步。

## 装到手机桌面（PWA）

站点带 `manifest.webmanifest` + Service Worker，可以直接「添加到主屏幕」，全屏运行、没有地址栏，断网也能打开查账。

- **iPhone**：用 Safari 打开站点 → 分享按钮 → 添加到主屏幕
- **Android**：Chrome → 右上角 ⋮ → 添加到主屏幕

SW 是**网络优先**策略（在线永远拿最新版，不会卡在旧代码），跨域请求（Supabase）完全不缓存。图标由 `make-icons.mjs` 用无头浏览器渲染生成，改图标重跑一次即可。详见 `docs/部署与实时同步方案.md` 第十二节。


## 目录

```
src/
  db/          Dexie schema + 示例数据种子
  lib/         日期、金额、统计、分享编解码
  components/  MonthPicker、ShareModal、Chart、QuickAddModal…
  pages/       首页/流水/报表/分类/账户/成员/商家/项目/设置/Join
```

## 校验

```bash
npm run build && node verify.mjs   # 需先起 preview（5199）
```

`verify.mjs` 用 playwright-core 驱动本机 Chrome，跑 14 个路由 + 记一笔写入回显 + 月份选择器 + 分享链接导入链路。
