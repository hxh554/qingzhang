import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, BOOK_ID, type Account } from '../db/schema';
import { accountBalance, netWorth } from '../lib/stats';
import { fmt } from '../lib/money';
import { IconPlus, IconEdit, IconTrash } from '../components/icons';

const ACC_TYPES = [['CASH', '现金'], ['BANK', '储蓄卡'], ['CREDIT', '信用卡'], ['ALIPAY', '支付宝'], ['WECHAT', '微信钱包'], ['INVEST', '投资账户'], ['LOAN', '借入款'], ['OTHER', '其他']];
const ICONS = ['💵', '💳', '🅰️', '💬', '🧾', '🏦', '📈', '🏠', '🪙', '💼'];

export default function Accounts() {
  const [tab, setTab] = useState<'asset' | 'liab'>('asset');
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<Account | 'NEW' | null>(null);
  const [adjusting, setAdjusting] = useState<Account | null>(null);

  const accounts = useLiveQuery(() => db.accounts.where('bookId').equals(BOOK_ID).sortBy('sort')) ?? [];
  const allTxs = useLiveQuery(() => db.txs.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const nw = useMemo(() => netWorth(accounts, allTxs), [accounts, allTxs]);

  const isLiab = tab === 'liab' ? 1 : 0;
  const list = accounts.filter(a => a.isLiability === isLiab && (showHidden || !a.isHidden));

  return (
    <div className="page">
      <div className="page-narrow" style={{ maxWidth: 1000 }}>
        <div className="card">
          <div className="flex" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 17, fontWeight: 500 }}>账户管理</span>
            <span className="muted" style={{ fontSize: 13 }}>净资产 <span className="num">{fmt(nw.net)}</span></span>
            <span className="muted" style={{ fontSize: 13 }}>总资产 <span className="num">{fmt(nw.assets)}</span></span>
            <span className="muted" style={{ fontSize: 13 }}>总负债 <span className="num">{fmt(nw.liabilities)}</span></span>
            <div className="flex-1" />
            <button className="btn btn-primary" onClick={() => setEditing('NEW')}><IconPlus /> 新建账户</button>
          </div>
          <div className="flex" style={{ marginBottom: 10 }}>
            <div className="tabs" style={{ flex: 1, marginBottom: 0 }}>
              <button className={`tab${tab === 'asset' ? ' active' : ''}`} onClick={() => setTab('asset')}>资产账户</button>
              <button className={`tab${tab === 'liab' ? ' active' : ''}`} onClick={() => setTab('liab')}>负债账户</button>
            </div>
            <label className="check"><input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} /> 显示已隐藏的账户</label>
          </div>
          <table className="table">
            <thead><tr>
              <th style={{ width: '26%' }}>账户名称</th><th>余额</th><th>币种</th><th>计入资产</th><th>备注</th><th className="right">操作</th>
            </tr></thead>
            <tbody>
              {list.map(a => {
                const b = accountBalance(a.id, allTxs, a.initBalance);
                return (
                  <tr key={a.id}>
                    <td><span style={{ fontSize: 16, marginRight: 8 }}>{a.icon}</span>{a.name} <span className="pill">{ACC_TYPES.find(t => t[0] === a.type)?.[1] ?? a.type}</span></td>
                    <td className={`num ${b < 0 ? 'expense' : ''}`}>{fmt(a.isLiability ? -b : b)}</td>
                    <td className="muted">CNY</td>
                    <td className="muted">{a.includeInAssets ? '是' : '否'}</td>
                    <td className="muted">{a.remark ?? '-'}</td>
                    <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn-text" onClick={() => setAdjusting(a)}>余额调整</button>
                      <button className="btn-text" onClick={() => setEditing(a)}><IconEdit /></button>
                      <button className="btn-text danger" onClick={async () => {
                        if (confirm(`删除账户「${a.name}」？若该账户存在流水，将无法删除。`)) {
                          const used = allTxs.some(t => t.accountId === a.id || t.toAccountId === a.id);
                          if (used) { alert('该账户存在流水，请先删除或迁移相关流水'); return; }
                          await db.accounts.delete(a.id);
                        }
                      }}><IconTrash /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!list.length && <div className="empty"><div className="empty-sub">还没有{tab === 'asset' ? '资产' : '负债'}账户，点右上角新建</div></div>}
        </div>
      </div>

      {editing && <AccModal acc={editing === 'NEW' ? null : editing} onClose={() => setEditing(null)} />}
      {adjusting && <AdjustModal acc={adjusting} onClose={() => setAdjusting(null)} />}
    </div>
  );
}

function AccModal({ acc, onClose }: { acc: Account | null; onClose: () => void }) {
  const [name, setName] = useState(acc?.name ?? '');
  const [icon, setIcon] = useState(acc?.icon ?? '💵');
  const [type, setType] = useState(acc?.type ?? 'CASH');
  const [isLiability, setIsLiability] = useState<0 | 1>(acc?.isLiability ?? 0);
  const [initBalance, setInitBalance] = useState(String(acc?.initBalance ?? 0));
  const [includeInAssets, setInclude] = useState<0 | 1>(acc?.includeInAssets ?? 1);
  const [remark, setRemark] = useState(acc?.remark ?? '');

  const save = async () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), icon, type, isLiability, initBalance: parseFloat(initBalance) || 0, includeInAssets, remark: remark.trim() || undefined };
    if (acc) await db.accounts.update(acc.id, data);
    else await db.accounts.add({ id: uid(), bookId: BOOK_ID, isHidden: 0, sort: Date.now(), ...data } as Account);
    onClose();
  };

  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 440 }}>
        <div className="modal-head"><span style={{ fontWeight: 500, fontSize: 15 }}>{acc ? '编辑账户' : '新建账户'}</span></div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">账户名称</label>
            <input className="input" value={name} autoFocus onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label className="field-label">类型</label>
              <select className="select" value={type} onChange={e => setType(e.target.value)}>
                {ACC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">账户性质</label>
              <select className="select" value={isLiability} onChange={e => setIsLiability(Number(e.target.value) as 0 | 1)}>
                <option value={0}>资产</option>
                <option value={1}>负债</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field-label">初始余额（元）</label>
            <input className="input num" value={initBalance} onChange={e => setInitBalance(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">备注</label>
            <input className="input" value={remark} onChange={e => setRemark(e.target.value)} />
          </div>
          <div className="field">
            <label className="check"><input type="checkbox" checked={includeInAssets === 1} onChange={e => setInclude(e.target.checked ? 1 : 0)} /> 计入净资产</label>
          </div>
          <div className="field">
            <label className="field-label">图标</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
              {ICONS.map(e => (
                <button key={e} onClick={() => setIcon(e)}
                  style={{ fontSize: 17, padding: '5px 0', borderRadius: 8, border: icon === e ? '1.5px solid var(--primary)' : '1.5px solid transparent', background: icon === e ? 'var(--primary-50)' : 'none' }}>{e}</button>
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

function AdjustModal({ acc, onClose }: { acc: Account; onClose: () => void }) {
  const [raw, setRaw] = useState('');
  const allTxs = useLiveQuery(() => db.txs.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const cur = accountBalance(acc.id, allTxs, acc.initBalance);

  const save = async () => {
    const target = parseFloat(raw);
    if (isNaN(target)) return;
    const diff = Math.round((target - cur) * 100) / 100;
    if (diff === 0) { onClose(); return; }
    await db.txs.add({
      id: uid(), bookId: BOOK_ID, type: 'ADJUST', amount: diff,
      accountId: acc.id, occurredAt: Date.now(),
      remark: `余额调整：${fmt(cur)} → ${fmt(target)}`,
      createdBy: 'adjust', createdAt: Date.now(),
    });
    onClose();
  };

  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 380 }}>
        <div className="modal-head"><span style={{ fontWeight: 500, fontSize: 15 }}>余额调整 · {acc.name}</span></div>
        <div className="modal-body">
          <div className="dim" style={{ fontSize: 13, marginBottom: 12 }}>当前余额 <b className="num">{fmt(cur)}</b>。调整会产生一笔「余额调整」记录，保证账实一致。</div>
          <div className="field">
            <label className="field-label">调整为（元）</label>
            <input className="input num" autoFocus value={raw} onChange={e => setRaw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()} placeholder={String(cur)} />
          </div>
          <div className="flex" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={save}>确认调整</button>
          </div>
        </div>
      </div>
    </div>
  );
}
