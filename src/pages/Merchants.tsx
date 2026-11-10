import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, BOOK_ID, type Merchant } from '../db/schema';
import { groupTotals } from '../lib/stats';
import { fmt } from '../lib/money';
import { IconPlus, IconEdit, IconTrash } from '../components/icons';

const ICONS = ['🛍️', '🍚', '🏪', '🏥', '🚕', '☕', '🎬', '🛒', '💊', '📦', '✂️', '🏋️'];

export function useEntitySpend(kind: 'merchantId' | 'projectId') {
  const allTxs = useLiveQuery(() => db.txs.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  return useMemo(() => groupTotals(allTxs, 'EXPENSE', t => (t as any)[kind]), [allTxs, kind]);
}

export default function Merchants() {
  const [editing, setEditing] = useState<Merchant | 'NEW' | null>(null);
  const merchants = useLiveQuery(() => db.merchants.where('bookId').equals(BOOK_ID).sortBy('sort')) ?? [];
  const spend = useEntitySpend('merchantId');
  const totalOf = (id: string) => spend.find(s => s.id === id)?.total ?? 0;
  const countOf = (id: string) => spend.find(s => s.id === id)?.count ?? 0;

  return (
    <div className="page">
      <div className="page-narrow" style={{ maxWidth: 900 }}>
        <div className="card">
          <div className="flex" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 17, fontWeight: 500 }}>商家管理</span>
            <div className="flex-1" />
            <button className="btn btn-primary" onClick={() => setEditing('NEW')}><IconPlus /> 新增商家</button>
          </div>
          <div className="table-scroll">
          <table className="table">
            <thead><tr><th style={{ width: '40%' }}>商家名称</th><th>消费金额</th><th className="hide-sm">笔数</th><th className="right">操作</th></tr></thead>
            <tbody>
              {merchants.map(m => (
                <tr key={m.id}>
                  <td><span style={{ fontSize: 16, marginRight: 8 }}>{m.icon}</span>{m.name}</td>
                  <td className="num">{fmt(totalOf(m.id))}</td>
                  <td className="muted hide-sm">{countOf(m.id)} 笔</td>
                  <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-text" onClick={() => setEditing(m)}><IconEdit /></button>
                    <button className="btn-text danger" onClick={async () => {
                      if (confirm(`删除商家「${m.name}」？历史流水中该商家将被置空。`)) {
                        await db.txs.where('merchantId').equals(m.id).modify({ merchantId: undefined });
                        await db.merchants.delete(m.id);
                      }
                    }}><IconTrash /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {!merchants.length && <div className="empty"><div className="empty-sub">还没有商家，点右上角新增</div></div>}
        </div>
      </div>
      {editing && <MerchantModal m={editing === 'NEW' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MerchantModal({ m, onClose }: { m: Merchant | null; onClose: () => void }) {
  const [name, setName] = useState(m?.name ?? '');
  const [icon, setIcon] = useState(m?.icon ?? '🛍️');
  const save = async () => {
    if (!name.trim()) return;
    if (m) await db.merchants.update(m.id, { name: name.trim(), icon });
    else await db.merchants.add({ id: uid(), bookId: BOOK_ID, name: name.trim(), icon, isHidden: 0, sort: Date.now() });
    onClose();
  };
  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 380 }}>
        <div className="modal-head"><span style={{ fontWeight: 500, fontSize: 15 }}>{m ? '编辑商家' : '新增商家'}</span></div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">商家名称</label>
            <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <div className="field">
            <label className="field-label">图标</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {ICONS.map(e => (
                <button key={e} onClick={() => setIcon(e)}
                  style={{ fontSize: 18, padding: '7px 0', borderRadius: 8, border: icon === e ? '1.5px solid var(--primary)' : '1.5px solid transparent', background: icon === e ? 'var(--primary-50)' : 'none' }}>{e}</button>
              ))}
            </div>
          </div>
          <div className="flex" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={save}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
