import { Fragment, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, BOOK_ID, type Category } from '../db/schema';
import { fmt } from '../lib/money';
import { IconPlus, IconEdit, IconTrash } from '../components/icons';

const EMOJIS = ['🍜', '🍚', '🍎', '☕', '🚗', '🚌', '🚕', '🏠', '💡', '📱', '👕', '👟', '💄', '🎮', '🎬', '⚽', '🏥', '💊', '📚', '✈️', '🎁', '🧧', '🏦', '💰', '🛒', '🛍️', '🐾', '📦', '💼', '🎓', '🚗', '🧹'];

export default function Categories() {
  const [tab, setTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<Category | 'NEW' | null>(null);
  const [delTarget, setDelTarget] = useState<{ cat: Category; txCount: number } | null>(null);
  const [moveTo, setMoveTo] = useState('');

  const categories = useLiveQuery(() => db.categories.where('[bookId+type]').equals([BOOK_ID, tab]).sortBy('sort'), [tab]) ?? [];
  const allTxs = useLiveQuery(() => db.txs.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const txCountByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of allTxs) if (t.categoryId) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1);
    return m;
  }, [allTxs]);
  const spentByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of allTxs) {
      if (t.type !== tab) continue;
      if (!t.categoryId) continue;
      m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
    }
    return m;
  }, [allTxs, tab]);

  const parents = categories.filter(c => !c.parentId && (showHidden || !c.isHidden));
  const childrenOf = (pid: string) => categories.filter(c => c.parentId === pid && (showHidden || !c.isHidden));

  const del = async (cat: Category) => {
    const own = (txCountByCat.get(cat.id) ?? 0) + categories.filter(c => c.parentId === cat.id).reduce((s, c) => s + (txCountByCat.get(c.id) ?? 0), 0);
    if (own > 0) {
      const siblings = categories.filter(c => c.id !== cat.id && (c.parentId === cat.parentId ? c.parentId !== null : c.parentId === null) && c.type === cat.type);
      setDelTarget({ cat, txCount: own });
      setMoveTo(siblings[0]?.id ?? '');
    } else if (categories.some(c => c.parentId === cat.id)) {
      alert('请先删除该分类下的子分类');
    } else {
      if (confirm(`删除分类「${cat.name}」？`)) await db.categories.delete(cat.id);
    }
  };

  const confirmDel = async (withTxs: boolean) => {
    if (!delTarget) return;
    const ids = [delTarget.cat.id, ...categories.filter(c => c.parentId === delTarget.cat.id).map(c => c.id)];
    await db.transaction('rw', db.categories, db.txs, async () => {
      if (withTxs) {
        await db.txs.where('categoryId').anyOf(ids).delete();
      } else if (moveTo) {
        await db.txs.where('categoryId').anyOf(ids).modify({ categoryId: moveTo });
      }
      await db.categories.bulkDelete(ids);
    });
    setDelTarget(null);
  };

  return (
    <div className="page">
      <div className="page-narrow" style={{ maxWidth: 1000 }}>
        <div className="card">
          <div className="flex" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 17, fontWeight: 500 }}>收支分类管理</span>
            <div className="flex-1" />
            <button className="btn btn-primary" onClick={() => setEditing('NEW')}><IconPlus /> 新增分类</button>
          </div>
          <div className="flex" style={{ marginBottom: 10 }}>
            <div className="tabs" style={{ flex: 1, marginBottom: 0 }}>
              <button className={`tab${tab === 'EXPENSE' ? ' active' : ''}`} onClick={() => setTab('EXPENSE')}>支出类型</button>
              <button className={`tab${tab === 'INCOME' ? ' active' : ''}`} onClick={() => setTab('INCOME')}>收入类型</button>
            </div>
            <label className="check"><input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} /> 显示已隐藏的分类</label>
          </div>

          <table className="table">
            <thead><tr>
              <th style={{ width: '46%' }}>分类名称</th>
              <th>{tab === 'EXPENSE' ? '本月内累计支出' : '累计'}</th>
              <th className="right">操作</th>
            </tr></thead>
            <tbody>
              {parents.map(p => (
                <Fragment key={p.id}>
                  <tr>
                    <td><span className="muted" style={{ marginRight: 6, cursor: 'grab' }}>≡</span> <span style={{ fontSize: 16, marginRight: 6 }}>{p.icon}</span><b style={{ fontWeight: 500 }}>{p.name}</b></td>
                    <td className="num">{fmt(spentByCat.get(p.id) ?? 0)}</td>
                    <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn-text" onClick={() => setEditing(p)}><IconEdit /> 编辑</button>
                      <button className="btn-text danger" onClick={() => del(p)}><IconTrash /> 删除</button>
                    </div></td>
                  </tr>
                  {childrenOf(p.id).map(c => (
                    <tr key={c.id}>
                      <td style={{ paddingLeft: 44 }}><span style={{ fontSize: 15, marginRight: 6 }}>{c.icon || '🏷️'}</span>{c.name}</td>
                      <td className="num">{fmt(spentByCat.get(c.id) ?? 0)}</td>
                      <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn-text" onClick={() => setEditing(c)}><IconEdit /> 编辑</button>
                        <button className="btn-text danger" onClick={() => del(c)}><IconTrash /> 删除</button>
                      </div></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!parents.length && <div className="empty"><div className="empty-sub">还没有分类，点右上角新增</div></div>}
        </div>
      </div>

      {editing && <CatModal cat={editing === 'NEW' ? null : editing} type={tab} onClose={() => setEditing(null)} />}

      {delTarget && (
        <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) setDelTarget(null); }}>
          <div className="modal" style={{ width: 420 }}>
            <div className="modal-body">
              <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 8 }}>删除「{delTarget.cat.name}」</div>
              <div className="dim" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
                该分类下有 <b className="num">{delTarget.txCount}</b> 笔流水。删除前请选择处理方式：
              </div>
              <div className="field">
                <label className="field-label">将流水迁移到其他分类</label>
                <select className="select" value={moveTo} onChange={e => setMoveTo(e.target.value)}>
                  {categories.filter(c => c.id !== delTarget.cat.id && c.type === delTarget.cat.type).map(c =>
                    <option key={c.id} value={c.id}>{(c.parentId ? '　' : '') + c.name}</option>)}
                </select>
              </div>
              <div className="flex" style={{ gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => confirmDel(true)}>连同流水一起删除</button>
                <button className="btn btn-primary" disabled={!moveTo} onClick={() => confirmDel(false)}>迁移后删除</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CatModal({ cat, type, onClose }: { cat: Category | null; type: 'EXPENSE' | 'INCOME'; onClose: () => void }) {
  const categories = useLiveQuery(() => db.categories.where('[bookId+type]').equals([BOOK_ID, type]).sortBy('sort')) ?? [];
  const [name, setName] = useState(cat?.name ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? (type === 'EXPENSE' ? '🍜' : '💰'));
  const [parentId, setParentId] = useState<string>(cat?.parentId ?? '');
  const isTop = !parentId;

  const save = async () => {
    if (!name.trim()) return;
    if (cat) {
      await db.categories.update(cat.id, { name: name.trim(), icon, parentId: parentId || null });
    } else {
      const maxSort = Math.max(0, ...categories.filter(c => c.parentId === (parentId || null)).map(c => c.sort));
      await db.categories.add({ id: uid(), bookId: BOOK_ID, name: name.trim(), icon, type, parentId: parentId || null, sort: maxSort + 1, isHidden: 0 });
    }
    onClose();
  };

  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 420 }}>
        <div className="modal-head"><span style={{ fontWeight: 500, fontSize: 15 }}>{cat ? '编辑分类' : '新增分类'}</span></div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">分类名称</label>
            <input className="input" value={name} autoFocus onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <div className="field">
            <label className="field-label">上级分类（留空为一级分类）</label>
            <select className="select" value={parentId} onChange={e => setParentId(e.target.value)}>
              <option value="">（一级分类）</option>
              {categories.filter(c => !c.parentId && c.id !== cat?.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">图标</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4 }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setIcon(e)}
                  style={{ fontSize: 17, padding: '5px 0', borderRadius: 8, border: icon === e ? '1.5px solid var(--primary)' : '1.5px solid transparent', background: icon === e ? 'var(--primary-50)' : 'none' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          {cat && !isTop && cat.parentId === null && (
            <div className="dim" style={{ fontSize: 12, marginBottom: 10 }}>提示：一级分类改为二级后，其原有子分类会一并归属新上级。</div>
          )}
          <div className="flex" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={save}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
