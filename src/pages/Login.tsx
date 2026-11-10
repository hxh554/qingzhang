import { useState } from 'react';
import { supabase, cloudEnabled } from '../lib/cloud';
import { ensureBook } from '../lib/sync';
import { useSync } from '../stores/sync';

export default function Login({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!supabase) return;
    if (!email.trim() || pw.length < 6) {
      setErr('邮箱必填，密码至少 6 位');
      return;
    }
    setBusy(true); setErr(''); setMsg('');
    try {
      const res = mode === 'in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
        : await supabase.auth.signUp({ email: email.trim(), password: pw });
      if (res.error) throw res.error;
      if (mode === 'up' && !res.data.session) {
        setMsg('注册成功，请到邮箱点击确认链接后再登录（也可在 Supabase 后台关闭邮箱确认）');
        setBusy(false);
        return;
      }
      useSync.getState().set({ email: res.data.user?.email ?? null });
      await ensureBook();
      useSync.getState().set({ ready: true });
      onDone();
    } catch (e: any) {
      const m = String(e?.message ?? e);
      setErr(
        /Invalid login credentials/i.test(m) ? '邮箱或密码不对'
          : /already registered/i.test(m) ? '这个邮箱已注册，请直接登录'
          : /Email not confirmed/i.test(m) ? '邮箱还没确认，请检查邮件'
          : /Failed to fetch|NetworkError|fetch failed/i.test(m) ? '连不上云端：检查网络，或确认 .env 里的 Supabase 地址填对了'
          : m
      );
      setBusy(false);
    }
  };

  if (!cloudEnabled) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="card" style={{ width: 420, padding: 24 }}>
          <div className="empty-title">未配置云端</div>
          <div className="empty-sub">这只会在开发者本机出现：需要 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="card" style={{ width: 380, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 30 }}>📒</div>
          <div className="empty-title">轻账 · 家庭共享账本</div>
          <div className="empty-sub">登录后，你和家人的记账会实时同步到同一本账</div>
        </div>

        <div className="field">
          <label className="field-label">邮箱</label>
          <input className="input" autoFocus value={email} onChange={e => { setEmail(e.target.value); setErr(''); }}
            placeholder="you@example.com" onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <div className="field">
          <label className="field-label">密码</label>
          <input className="input" type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(''); }}
            placeholder="至少 6 位" onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>

        {err && <div className="dim" style={{ fontSize: 12, color: 'var(--expense)', marginBottom: 10 }}>{err}</div>}
        {msg && <div className="dim" style={{ fontSize: 12, color: 'var(--income)', marginBottom: 10, lineHeight: 1.6 }}>{msg}</div>}

        <button className="btn btn-primary" style={{ width: '100%', height: 40, justifyContent: 'center' }} disabled={busy} onClick={submit}>
          {busy ? '请稍候…' : mode === 'in' ? '登录' : '注册并创建账本'}
        </button>

        <div className="flex" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn-text" onClick={() => { setMode(m => (m === 'in' ? 'up' : 'in')); setErr(''); setMsg(''); }}>
            {mode === 'in' ? '第一个用？点这里注册' : '已有账号，去登录'}
          </button>
        </div>

        <div className="dim" style={{ fontSize: 11.5, marginTop: 16, lineHeight: 1.7, background: 'var(--bg)', borderRadius: 8, padding: 10 }}>
          同一个账号在多台设备登录即可看到同一本账；家人用你给的<strong>邀请码</strong>加入，不用注册新账本。
        </div>
      </div>
    </div>
  );
}
