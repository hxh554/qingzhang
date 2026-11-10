import { useEffect, useState } from 'react';
import { decodeSnap, importSnap, snapSummary, type Snap } from '../lib/share';
import { SEED_FLAG } from '../db/seed';
import { navigate } from '../lib/router';

export default function Join({ code }: { code: string }) {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    decodeSnap(code)
      .then(s => { if (alive) setSnap(s); })
      .catch(e => { if (alive) setErr(e?.message ?? '分享码无法识别'); });
    return () => { alive = false; };
  }, [code]);

  const doImport = async () => {
    if (!snap) return;
    setBusy(true);
    try {
      await importSnap(snap);
      localStorage.setItem(SEED_FLAG, '1');
      navigate('/');
    } catch (e: any) {
      setErr(e?.message ?? '导入失败');
      setBusy(false);
    }
  };

  const sum = snap ? snapSummary(snap) : null;

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="card" style={{ width: 420, textAlign: 'center', padding: 28 }}>
        {err && (
          <>
            <div className="empty-icon">⚠️</div>
            <div className="empty-title">链接打不开</div>
            <div className="empty-sub" style={{ marginBottom: 18 }}>{err}</div>
            <button className="btn btn-ghost" onClick={() => navigate('/')}>返回首页</button>
          </>
        )}

        {!err && !snap && <div className="dim">正在解析分享链接…</div>}

        {!err && snap && sum && (
          <>
            <div style={{ fontSize: 34, marginBottom: 8 }}>{snap.book?.cover ?? '📒'}</div>
            <div className="empty-title">「{sum.name}」邀你查看账本</div>
            <div className="empty-sub" style={{ marginBottom: 18 }}>
              {sum.txCount} 笔流水 · {sum.memberCount} 位成员 · {sum.range}
            </div>
            <div className="dim" style={{ fontSize: 12, textAlign: 'left', background: 'var(--bg)', borderRadius: 10, padding: 12, marginBottom: 16, lineHeight: 1.7 }}>
              · 这是一份<strong>账本快照</strong>，导入后完全保存在你这台设备上<br />
              · 导入会<strong>覆盖</strong>你本机现有账本（含示例数据）<br />
              · 双方之后的记账<strong>不会自动同步</strong>，需再次分享
            </div>
            <div className="flex" style={{ gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => navigate('/')}>先看看</button>
              <button className="btn btn-primary" disabled={busy} onClick={doImport}>
                {busy ? '导入中…' : '导入到本机'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
