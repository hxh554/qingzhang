import { useState } from 'react';
import { cloudEnabled } from '../lib/cloud';
import { createInvite, joinByCode, signOut, uploadLocalTxs } from '../lib/sync';
import { useSync } from '../stores/sync';

export function CloudPanel() {
  const { email, bookName, online, pending, bookId } = useSync();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [joinCode, setJoinCode] = useState('');

  if (!cloudEnabled) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex" style={{ marginBottom: 10 }}>
          <b style={{ fontWeight: 500 }}>云端同步</b>
          <div className="flex-1" />
          <span className="pill">未启用</span>
        </div>
        <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.8, marginBottom: 12 }}>
          现在是<strong>纯本地版</strong>：数据只存在这台设备的浏览器里，家人各自记各自的，看不到同一本账，也就没有登录页。
          启用云端后，这里会变成账号面板，打开网站先要求登录。
        </div>
        <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.9, background: 'var(--bg)', borderRadius: 10, padding: 12 }}>
          <div style={{ marginBottom: 4 }}><strong>怎么开（约 10 分钟）</strong></div>
          1. supabase.com 注册 → New project<br />
          2. SQL Editor 里跑一遍 <code>supabase/schema.sql</code><br />
          3. Project Settings → API，复制 URL 和 anon key<br />
          4. 在项目根目录建 <code>.env</code>，填 <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code><br />
          5. 重新 <code>npm run build</code>（或刷新 dev 服务），登录页就会出现
        </div>
      </div>
    );
  }

  const gen = async () => {
    setBusy(true); setMsg('');
    try {
      setCode(await createInvite());
    } catch (e: any) {
      setMsg('生成失败：' + (e?.message ?? e));
    }
    setBusy(false);
  };

  const join = async () => {
    if (!joinCode.trim()) return;
    if (!confirm('加入后本机数据会替换成对方的账本（云端为准），继续？')) return;
    setBusy(true); setMsg('');
    try {
      await joinByCode(joinCode);
      location.hash = '/';
      location.reload();
    } catch (e: any) {
      setMsg('加入失败：' + (e?.message ?? e));
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="flex" style={{ marginBottom: 12 }}>
        <b style={{ fontWeight: 500 }}>云端同步</b>
        <div className="flex-1" />
        <span className="pill" style={{ background: online ? 'rgba(47,191,168,.12)' : 'rgba(255,107,107,.12)', color: online ? 'var(--income)' : 'var(--expense)' }}>
          {online ? '已连接' : '离线'}　{pending > 0 ? `待同步 ${pending}` : '已同步'}
        </span>
      </div>

      <div className="list-row">
        <div className="cat-icon" style={{ background: 'var(--primary-50)' }}>👤</div>
        <div className="flex-1" style={{ fontSize: 13 }}>
          {email ?? '未登录'}
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>账本「{bookName ?? '-'}」· {bookId ? bookId.slice(0, 8) : '-'}</div>
        </div>
        <button className="btn-text" onClick={() => signOut()}>退出登录</button>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0' }} />

      <div style={{ fontSize: 13, marginBottom: 6 }}>把本机流水补传到云端</div>
      <div className="dim" style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 10 }}>
        首次登录只同步了分类、账户这些骨架，本机已有的流水需要手动传一次（含演示数据，传完可在「数据管理」里清空）。
      </div>
      <button className="btn btn-ghost" disabled={busy} onClick={async () => {
        if (!confirm('把本机全部流水上传到当前云端账本？')) return;
        setBusy(true); setMsg('上传中，请稍候…');
        try { await uploadLocalTxs(); setMsg('已上传'); } catch (e: any) { setMsg('上传失败：' + (e?.message ?? e)); }
        setBusy(false);
      }}>⬆ 上传本机流水</button>

      <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0' }} />

      <div style={{ fontSize: 13, marginBottom: 6 }}>邀请家人加入这本账</div>
      <div className="dim" style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 10 }}>
        生成 6 位邀请码发给家人，对方登录后在这里输入，就能看到同一本账（24 小时内有效）。
      </div>
      <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={busy} onClick={gen}>生成邀请码</button>
        {code && (
          <div className="flex gap-8" style={{ alignItems: 'center' }}>
            <span className="num" style={{ fontSize: 20, letterSpacing: 4, fontWeight: 500, color: 'var(--primary)' }}>{code}</span>
            <button className="btn-text" onClick={() => { navigator.clipboard?.writeText(code); setMsg('邀请码已复制'); }}>复制</button>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0' }} />

      <div style={{ fontSize: 13, marginBottom: 6 }}>加入家人的账本</div>
      <div className="flex gap-8">
        <input className="input" placeholder="输入 6 位邀请码" value={joinCode} maxLength={8}
          onChange={e => setJoinCode(e.target.value.toUpperCase())} style={{ maxWidth: 200, letterSpacing: 2 }} />
        <button className="btn btn-ghost" disabled={busy || !joinCode.trim()} onClick={join}>加入</button>
      </div>

      {msg && <div className="dim" style={{ fontSize: 12, marginTop: 10, color: 'var(--primary)' }}>{msg}</div>}
    </div>
  );
}
