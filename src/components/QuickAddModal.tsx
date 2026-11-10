import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, BOOK_ID, type Tx, type TxType } from '../db/schema';
import { useUi } from '../stores/ui';
import { evalAmount } from '../lib/money';
import { startOfDay, MS_DAY } from '../lib/date';

export function QuickAddModal() {
  const { quickAddOpen, quickAddType, editing, closeQuickAdd } = useUi();
  const [type, setType] = useState<TxType>('EXPENSE');
  const [amountRaw, setAmountRaw] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [memberId, setMemberId] = useState<string>('');
  const [dayOffset, setDayOffset] = useState(0);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [err, setErr] = useState('');
  const [savedTip, setSavedTip] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  const categories = useLiveQuery(() => db.categories.where('[bookId+type]').equals([BOOK_ID, type === 'TRANSFER' ? 'EXPENSE' : type]).sortBy('sort'), [type]) ?? [];
  const accounts = useLiveQuery(() => db.accounts.where('bookId').equals(BOOK_ID).sortBy('sort')) ?? [];
  const members = useLiveQuery(() => db.members.where('bookId').equals(BOOK_ID).toArray()) ?? [];

  useEffect(() => {
    if (!quickAddOpen) return;
    setErr(''); setSavedTip('');
    if (editing) {
      setType(editing.type);
      setAmountRaw(String(editing.amount));
      setCategoryId(editing.categoryId ?? null);
      setAccountId(editing.accountId);
      setToAccountId(editing.toAccountId ?? '');
      setMemberId(editing.memberId ?? '');
      const diff = Math.round((startOfDay(editing.occurredAt) - startOfDay(Date.now())) / MS_DAY);
      setDayOffset(diff >= -1 && diff <= 0 ? diff : 0);
      setCustomDate(diff >= -1 && diff <= 0 ? null : new Date(editing.occurredAt).toISOString().slice(0, 10));
      setRemark(editing.remark ?? '');
    } else {
      setType(quickAddType);
      setAmountRaw(''); setCategoryId(null); setRemark('');
      setDayOffset(0); setCustomDate(null);
    }
    setTimeout(() => amountRef.current?.focus(), 50);
  }, [quickAddOpen, editing, quickAddType]);

  useEffect(() => {
    if (!accounts.length) return;
    if (!accountId) setAccountId(accounts[0].id);
    if (!toAccountId) {
      const other = accounts.find(a => a.id !== accountId);
      if (other) setToAccountId(other.id);
    }
  }, [accounts, accountId]);

  useEffect(() => {
    if (!members.length) return;
    if (!memberId) setMemberId(members[0].id);
  }, [members]);

  /* 分类 Tab：一级分类 */
  const parents = useMemo(() => categories.filter(c => !c.parentId), [categories]);
  const [parentTab, setParentTab] = useState<string | null>(null);
  useEffect(() => {
    if (editing) {
      const cur = categories.find(c => c.id === categoryId);
      if (cur) setParentTab(cur.parentId ?? cur.id);
      return;
    }
    setParentTab(parents[0]?.id ?? null);
    setCategoryId(null);
  }, [type, parents.length]);

  const curParent = parentTab ?? parents[0]?.id;
  const children = useMemo(
    () => categories.filter(c => c.parentId === curParent),
    [categories, curParent]
  );
  const gridCells = children.length ? children : parents.filter(p => p.id === curParent);

  useEffect(() => {
    if (!editing && gridCells.length && categoryId && !gridCells.some(c => c.id === categoryId)) setCategoryId(null);
  }, [gridCells]);

  if (!quickAddOpen) return null;

  const occurredAt = customDate
    ? new Date(customDate + 'T12:00:00').getTime()
    : startOfDay(Date.now()) + dayOffset * MS_DAY + Date.now() % MS_DAY;

  const pick = (day: number) => { setDayOffset(day); setCustomDate(null); };
  const dayLabel = customDate ? customDate : dayOffset === 0 ? '今天' : dayOffset === -1 ? '昨天' : dayOffset === -2 ? '前天' : '';

  const save = async (keepOpen: boolean) => {
    const amount = evalAmount(amountRaw);
    if (amount == null || amount <= 0) { setErr('请输入正确的金额'); return; }
    if (type !== 'TRANSFER' && !categoryId) { setErr('请选择分类'); return; }
    if (type === 'TRANSFER' && toAccountId === accountId) { setErr('转账账户不能相同'); return; }
    const now = Date.now();
    const tx: Tx = {
      id: editing?.id ?? uid(),
      bookId: BOOK_ID, type, amount,
      categoryId: type === 'TRANSFER' ? undefined : categoryId!,
      accountId, toAccountId: type === 'TRANSFER' ? toAccountId : undefined,
      memberId, occurredAt, remark: remark.trim() || undefined,
      createdBy: editing?.createdBy ?? memberId,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now, updatedBy: memberId,
    };
    await db.txs.put(tx);
    setErr('');
    if (editing) { closeQuickAdd(); return; }
    setAmountRaw(''); setRemark('');
    setSavedTip(`已记一笔 ${type === 'EXPENSE' ? '支出' : type === 'INCOME' ? '收入' : '转账'}，可继续记`);
    setTimeout(() => amountRef.current?.focus(), 30);
    setTimeout(() => setSavedTip(''), 2500);
  };

  const onAmountKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save(true); }
  };

  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) closeQuickAdd(); }}>
      <div className="modal">
        <div className="modal-head">
          <div className="flex gap-8 flex-1">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as TxType[]).map(t => (
              <button key={t} className={`tab${type === t ? ' active' : ''}`} style={{ padding: '10px 4px', marginRight: 12 }}
                onClick={() => setType(t)}>
                {t === 'EXPENSE' ? '支出' : t === 'INCOME' ? '收入' : '转账'}
              </button>
            ))}
          </div>
          <button className="btn-text muted" onClick={closeQuickAdd}>关闭</button>
        </div>
        <div className="modal-body">
          <div className="flex gap-8" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 500 }}>¥</span>
            <input ref={amountRef} className="input-lg num" placeholder="0.00"
              value={amountRaw}
              onChange={e => { setAmountRaw(e.target.value); setErr(''); }}
              onKeyDown={onAmountKey} />
          </div>
          {savedTip && <div style={{ fontSize: 12, color: 'var(--income)', margin: '2px 0 6px' }}>{savedTip}</div>}

          {type !== 'TRANSFER' && (
            <>
              <div className="flex gap-8" style={{ margin: '10px 0 8px', flexWrap: 'wrap' }}>
                {parents.map(p => (
                  <button key={p.id} className={`pill${curParent === p.id ? ' orange' : ''}`}
                    onClick={() => setParentTab(p.id)}>{p.icon} {p.name}</button>
                ))}
              </div>
              <div className="cat-grid" style={{ marginBottom: 14 }}>
                {gridCells.map(c => (
                  <button key={c.id} className={`cat-cell${categoryId === c.id ? ' on' : ''}`}
                    onClick={() => setCategoryId(c.id)}>
                    <span className="ci">{c.icon || '🏷️'}</span>{c.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="grid-2" style={{ gridTemplateColumns: type === 'TRANSFER' ? '1fr 1fr' : '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label className="field-label">{type === 'TRANSFER' ? '转出账户' : '账户'}</label>
              <select className="select" value={accountId} onChange={e => setAccountId(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
            {type === 'TRANSFER' ? (
              <div className="field">
                <label className="field-label">转入账户</label>
                <select className="select" value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="field">
                <label className="field-label">成员</label>
                <select className="select" value={memberId} onChange={e => setMemberId(e.target.value)}>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="field">
            <label className="field-label">日期　{dayLabel && <span className="muted">{dayLabel}</span>}</label>
            <div className="flex gap-8">
              <button className="btn btn-ghost" style={dayOffset === 0 && !customDate ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined} onClick={() => pick(0)}>今天</button>
              <button className="btn btn-ghost" style={dayOffset === -1 && !customDate ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined} onClick={() => pick(-1)}>昨天</button>
              <button className="btn btn-ghost" style={dayOffset === -2 && !customDate ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined} onClick={() => pick(-2)}>前天</button>
              <input type="date" className="input" style={{ flex: 1 }} value={customDate ?? ''}
                onChange={e => setCustomDate(e.target.value || null)} />
            </div>
          </div>

          <div className="field">
            <label className="field-label">备注</label>
            <input className="input" placeholder="选填，支持关键词自动联想（如：打车）"
              value={remark} onChange={e => setRemark(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(true); }} />
          </div>

          {err && <div style={{ color: 'var(--expense)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}

          <button className="btn btn-primary" style={{ width: '100%', height: 42, fontSize: 14.5 }}
            onClick={() => save(true)}>
            {editing ? '保存修改' : '保存（Enter 连续记账）'}
          </button>
        </div>
      </div>
    </div>
  );
}
