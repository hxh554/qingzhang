import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BOOK_ID, type Tx } from '../db/schema';
import { useUi } from '../stores/ui';
import { monthRange, startOfDay, fmtTime, fmtWeekday, fmtMD } from '../lib/date';
import { sumOf } from '../lib/stats';
import { fmt } from '../lib/money';
import { IconSearch, IconPlus, IconEdit, IconTrash } from '../components/icons';
import { MonthPicker } from '../components/MonthPicker';

export default function Transactions() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const openQuickAdd = useUi(s => s.openQuickAdd);

  const [ms, me] = monthRange(ym.y, ym.m);
  const raw = useLiveQuery(
    () => db.txs.where('[bookId+occurredAt]').between([BOOK_ID, ms], [BOOK_ID, me]).toArray(),
    [ms, me]
  ) ?? [];
  const categories = useLiveQuery(() => db.categories.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const members = useLiveQuery(() => db.members.where('bookId').equals(BOOK_ID).toArray()) ?? [];

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const memMap = useMemo(() => new Map(members.map(m => [m.id, m.name])), [members]);
  const catName = (t: Tx) => {
    const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
    const p = c?.parentId ? catMap.get(c.parentId) : undefined;
    return c ? (p ? `${p.name} · ${c.name}` : c.name) : t.type === 'TRANSFER' ? '账户转账' : t.type === 'ADJUST' ? '余额调整' : '未分类';
  };
  const catIcon = (t: Tx) => {
    const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
    return c?.icon || (t.type === 'TRANSFER' ? '🔁' : '🏷️');
  };

  const txs = useMemo(() => {
    let list = [...raw].sort((a, b) => b.occurredAt - a.occurredAt);
    if (typeFilter) list = list.filter(t => t.type === typeFilter);
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      list = list.filter(t =>
        (t.remark ?? '').toLowerCase().includes(k) ||
        catName(t).toLowerCase().includes(k)
      );
    }
    return list;
  }, [raw, typeFilter, q, catMap]);

  const totalEx = sumOf(txs, 'EXPENSE');
  const totalIn = sumOf(txs, 'INCOME');

  /* 按日分组 */
  const groups = useMemo(() => {
    const map = new Map<number, Tx[]>();
    for (const t of txs) {
      const d = startOfDay(t.occurredAt);
      (map.get(d) ?? map.set(d, []).get(d)!).push(t);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [txs]);

  const del = async (t: Tx) => {
    if (confirm(`删除这笔「${catName(t)} ${fmt(t.amount)}」？此操作不可恢复。`)) {
      await db.txs.delete(t.id);
    }
  };

  return (
    <div className="page">
      <div className="page-narrow" style={{ maxWidth: 980, margin: '0 auto' }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex" style={{ flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 17, fontWeight: 500 }}>流水列表</span>
            <span className="muted" style={{ fontSize: 13 }}>结余 <span className="num">{fmt(totalIn - totalEx)}</span></span>
            <span className="muted" style={{ fontSize: 13 }}>收入 <span className="num income">{fmt(totalIn)}</span></span>
            <span className="muted" style={{ fontSize: 13 }}>支出 <span className="num expense">{fmt(totalEx)}</span></span>
            <div className="flex-1" />
            <MonthPicker y={ym.y} m={ym.m} onChange={(yy, mm) => setYm({ y: yy, m: mm })} />
          </div>
          <div className="flex" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <div className="flex flex-1" style={{ position: 'relative', minWidth: 200 }}>
              <span style={{ position: 'absolute', left: 10, color: 'var(--text-4)', display: 'flex' }}><IconSearch /></span>
              <input className="input" placeholder="搜索备注或分类" style={{ paddingLeft: 34 }}
                value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <select className="select" style={{ width: 110 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">全部类型</option>
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
              <option value="TRANSFER">转账</option>
            </select>
            <button className="btn btn-primary" onClick={() => openQuickAdd('EXPENSE')}><IconPlus /> 记一笔</button>
          </div>
        </div>

        {groups.length === 0 && (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">🗒️</div>
              <div className="empty-title">无流水</div>
              <div className="empty-sub">什么都还没有呢，快去添加吧</div>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => openQuickAdd('EXPENSE')}>记一笔</button>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: '4px 16px' }}>
          {groups.map(([day, list]) => {
            const dEx = sumOf(list, 'EXPENSE');
            const dIn = sumOf(list, 'INCOME');
            return (
              <div key={day}>
                <div className="day-head">
                  <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{fmtMD(day)} {fmtWeekday(day)}</span>
                  <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
                  <span>{dIn > 0 && <>收 <span className="num income">{fmt(dIn)}</span>　</>}</span>
                  <span>{dEx > 0 && <>支 <span className="num expense">{fmt(dEx)}</span></>}</span>
                </div>
                {list.map(t => (
                  <div className="tx-row" key={t.id}>
                    <div className="tx-cat">{catIcon(t)}</div>
                    <div className="tx-main">
                      <div className="tx-title">{catName(t)}{t.remark ? ` · ${t.remark}` : ''}</div>
                      <div className="tx-sub">
                        {accMap.get(t.accountId)?.name ?? ''}
                        {t.type === 'TRANSFER' && ` → ${accMap.get(t.toAccountId ?? '')?.name ?? ''}`}
                        {t.memberId && ` · ${memMap.get(t.memberId) ?? ''}`}
                        {` · ${fmtTime(t.occurredAt)}`}
                      </div>
                    </div>
                    <div className="tx-ops">
                      <button className="btn-text" title="编辑" onClick={() => openQuickAdd(t.type, t)}><IconEdit /></button>
                      <button className="btn-text danger" title="删除" onClick={() => del(t)}><IconTrash /></button>
                    </div>
                    <span className={`tx-amount num ${t.type === 'INCOME' ? 'income' : t.type === 'TRANSFER' ? 'muted' : 'expense'}`}>
                      {t.type === 'INCOME' ? '+' : t.type === 'EXPENSE' ? '-' : ''}{fmt(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
