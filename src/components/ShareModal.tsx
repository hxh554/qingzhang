import { useEffect, useState, type ChangeEvent } from 'react';
import { buildSnap, encodeSnap, decodeSnap, importSnap, joinLink, snapSummary } from '../lib/share';
import { SEED_FLAG } from '../db/seed';

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export function ShareModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [link, setLink] = useState('');
  const [info, setInfo] = useState<{ txCount: number; memberCount: number; range: string } | null>(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await buildSnap();
        const c = await encodeSnap(snap);
        setCode(c);
        setLink(joinLink(c));
        setInfo(snapSummary(snap));
      } catch (e: any) {
        setErr(e?.message ?? '生成失败');
      }
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const doCopy = async (text: string, label: string) => {
    if (!text) return;
    setToast((await copy(text)) ? `已复制${label}` : '复制失败，请手动选中复制');
  };

  const doImport = async (text?: string) => {
    const payload = (text ?? paste).trim();
    if (!payload) return;
    setBusy(true);
    try {
      const snap = await decodeSnap(payload);
      if (!confirm(`导入「${snap.name}」？本机现有账本（含示例数据）将被覆盖，且不可撤销。`)) {
        setBusy(false);
        return;
      }
      await importSnap(snap);
      localStorage.setItem(SEED_FLAG, '1');
      location.reload();
    } catch (e: any) {
      setErr(e?.message ?? '导入失败');
      setBusy(false);
    }
  };

  const download = () => {
    if (!code) return;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `轻账-${new Date().toISOString().slice(0, 10)}.qzbook`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    setToast('已导出账本文件');
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    e.target.value = '';
    await doImport(text);
  };

  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 520 }}>
        <div className="modal-head" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500, fontSize: 15 }}>分享账本</span>
          <button className="btn-text" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        <div className="modal-body">
          <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.75, background: 'var(--bg)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            轻账是<strong>纯本地账本</strong>，没有服务器。分享出去的是当前账本的<strong>快照</strong>：
            对方打开链接导入后，数据就存在他自己的设备上；此后双方各自记账，<strong>不会自动同步</strong>，
            想看最新情况需要再次分享。
          </div>

          <div className="field">
            <label className="field-label">分享链接（点开即可导入）</label>
            <div className="flex" style={{ gap: 8 }}>
              <input className="input" readOnly value={link || (err ? '生成失败' : '生成中…')} onFocus={e => e.currentTarget.select()} />
              <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={!link} onClick={() => doCopy(link, '链接')}>复制</button>
            </div>
            {info && (
              <div className="dim" style={{ fontSize: 11.5, marginTop: 6 }}>
                {info.txCount} 笔流水 · {info.memberCount} 位成员 · {info.range} · 链接长度 {link.length} 字符
              </div>
            )}
          </div>

          <div className="field">
            <label className="field-label">分享码（链接太长时，发这段文本给对方粘贴）</label>
            <textarea
              className="input" readOnly rows={3} value={code}
              style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11, resize: 'vertical', lineHeight: 1.5 }}
              onFocus={e => e.currentTarget.select()}
            />
            <div className="flex" style={{ marginTop: 8, gap: 8 }}>
              <button className="btn btn-ghost" disabled={!code} onClick={() => doCopy(code, '分享码')}>复制分享码</button>
              <button className="btn btn-ghost" disabled={!code} onClick={download}>⬇ 导出账本文件</button>
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 6 }}>
              链接太长（微信常被截断）时，优先发<strong>分享码</strong>或<strong>账本文件</strong>给对方。
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0 12px' }} />

          <div className="field">
            <label className="field-label">或者：导入别人发来的账本</label>
            <textarea
              className="input" rows={2} placeholder="粘贴对方给的分享码…"
              value={paste} onChange={e => { setPaste(e.target.value); setErr(''); }}
              style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11, resize: 'vertical' }}
            />
            {err && <div className="dim" style={{ fontSize: 11.5, color: 'var(--expense)', marginTop: 6 }}>{err}</div>}
            <div className="flex" style={{ marginTop: 8 }}>
              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                📂 选择 .qzbook 文件导入
                <input type="file" accept=".qzbook,.json,text/plain" style={{ display: 'none' }} onChange={onFile} />
              </label>
            </div>
          </div>

          <div className="flex" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>关闭</button>
            <button className="btn btn-primary" disabled={!paste.trim() || busy} onClick={() => doImport()}>
              {busy ? '导入中…' : '导入并覆盖'}
            </button>
          </div>
        </div>
      </div>
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 60, transform: 'translateX(-50%)', background: 'rgba(31,35,41,.88)', color: '#fff', fontSize: 13, padding: '8px 16px', borderRadius: 20, zIndex: 200 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
