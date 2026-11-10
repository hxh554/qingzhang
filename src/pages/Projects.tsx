import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, BOOK_ID, type Project } from '../db/schema';
import { fmt } from '../lib/money';
import { IconPlus, IconEdit, IconTrash } from '../components/icons';
import { useEntitySpend } from './Merchants';

const ICONS = ['🛒', '📅', '🛠️', '✈️', '🧧', '🎓', '🏠', '💻', '📸', '🎁', '🚗', '👶'];

export default function Projects() {
  const [editing, setEditing] = useState<Project | 'NEW' | null>(null);
  const projects = useLiveQuery(() => db.projects.where('bookId').equals(BOOK_ID).sortBy('sort')) ?? [];
  const spend = useEntitySpend('projectId');
  const totalOf = (id: string) => spend.find(s => s.id === id)?.total ?? 0;
  const countOf = (id: string) => spend.find(s => s.id === id)?.count ?? 0;

  return (
    <div className="page">
      <div className="page-narrow" style={{ maxWidth: 900 }}>
        <div className="card">
          <div className="flex" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 17, fontWeight: 500 }}>项目管理</span>
            <div className="flex-1" />
            <button className="btn btn-primary" onClick={() => setEditing('NEW')}><IconPlus /> 新增项目</button>
          </div>
          <table className="table">
            <thead><tr><th style={{ width: '40%' }}>项目名称</th><th>支出金额</th><th>笔数</th><th className="right">操作</th></tr></thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id}>
                  <td><span style={{ fontSize: 16, marginRight: 8 }}>{p.icon}</span>{p.name}</td>
                  <td className="num">{fmt(totalOf(p.id))}</td>
                  <td className="muted">{countOf(p.id)} 笔</td>
                  <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-text" onClick={() => setEditing(p)}><IconEdit /></button>
                    <button className="btn-text danger" onClick={async () => {
                      if (confirm(`删除项目「${p.name}」？历史流水中该项目将被置空。`)) {
                        await db.txs.where('projectId').equals(p.id).modify({ projectId: undefined });
                        await db.projects.delete(p.id);
                      }
                    }}><IconTrash /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!projects.length && <div className="empty"><div className="empty-sub">还没有项目，点右上角新增</div></div>}
        </div>
      </div>
      {editing && <ProjectModal p={editing === 'NEW' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProjectModal({ p, onClose }: { p: Project | null; onClose: () => void }) {
  const [name, setName] = useState(p?.name ?? '');
  const [icon, setIcon] = useState(p?.icon ?? '🛒');
  const save = async () => {
    if (!name.trim()) return;
    if (p) await db.projects.update(p.id, { name: name.trim(), icon });
    else await db.projects.add({ id: uid(), bookId: BOOK_ID, name: name.trim(), icon, isHidden: 0, sort: Date.now() });
    onClose();
  };
  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 380 }}>
        <div className="modal-head"><span style={{ fontWeight: 500, fontSize: 15 }}>{p ? '编辑项目' : '新增项目'}</span></div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">项目名称</label>
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
