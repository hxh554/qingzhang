import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid, BOOK_ID, type Member } from '../db/schema';
import { groupTotals } from '../lib/stats';
import { fmt } from '../lib/money';
import { IconPlus, IconEdit, IconTrash } from '../components/icons';
import { ShareModal } from '../components/ShareModal';

const ROLES: Array<[Member['role'], string]> = [['OWNER', '账本主人'], ['ADMIN', '管理员'], ['MEMBER', '成员'], ['VIEWER', '只读成员']];

export default function Members() {
  const [editing, setEditing] = useState<Member | 'NEW' | null>(null);
  const [sharing, setSharing] = useState(false);
  const members = useLiveQuery(() => db.members.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const allTxs = useLiveQuery(() => db.txs.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const spend = useMemo(() => groupTotals(allTxs, 'EXPENSE', t => t.memberId), [allTxs]);
  const joined = members.filter(m => m.status === 'JOINED');
  const invited = members.filter(m => m.status === 'INVITED');
  const spendOf = (id: string) => spend.find(s => s.id === id)?.total ?? 0;

  return (
    <div className="page">
      <div className="page-narrow" style={{ maxWidth: 900 }}>
        <div className="card">
          <div className="flex" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 17, fontWeight: 500 }}>成员管理</span>
            <div className="flex-1" />
            <button className="btn btn-ghost" onClick={() => setSharing(true)}>🔗 分享账本</button>
            <button className="btn btn-primary" style={{ marginLeft: 8 }} onClick={() => setEditing('NEW')}><IconPlus /> 邀请成员</button>
          </div>

          <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>已加入账本</div>
          <table className="table">
            <thead><tr><th style={{ width: '24%' }}>成员</th><th>备注</th><th>角色</th><th>累计支出</th><th className="right">操作</th></tr></thead>
            <tbody>
              {joined.map(m => (
                <tr key={m.id}>
                  <td>
                    <span className="cat-icon" style={{ background: 'var(--primary-50)', marginRight: 8 }}>{m.name.slice(0, 1)}</span>
                    {m.name}
                  </td>
                  <td className="muted">{m.remark ?? '-'}</td>
                  <td><span className="pill orange">{ROLES.find(r => r[0] === m.role)?.[1]}</span></td>
                  <td className="num">{fmt(spendOf(m.id))}</td>
                  <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-text" onClick={() => setEditing(m)}><IconEdit /></button>
                    {m.role !== 'OWNER' && <button className="btn-text danger" onClick={async () => {
                      if (confirm(`移除成员「${m.name}」？历史流水将归属账本主人。`)) {
                        await db.txs.where('memberId').equals(m.id).modify({ memberId: members.find(x => x.role === 'OWNER')?.id });
                        await db.members.delete(m.id);
                      }
                    }}><IconTrash /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>

          {invited.length > 0 && (
            <>
              <div className="muted" style={{ fontSize: 12.5, margin: '18px 0 6px' }}>待接受邀请</div>
              <table className="table">
                <tbody>
                  {invited.map(m => (
                    <tr key={m.id}>
                      <td><span className="cat-icon" style={{ background: 'var(--bg)', marginRight: 8 }}>✉️</span>{m.name}</td>
                      <td className="muted">等待接受邀请</td>
                      <td className="right"><button className="btn-text danger" onClick={async () => { await db.members.delete(m.id); }}>取消邀请</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {editing && <MemberModal m={editing === 'NEW' ? null : editing} onClose={() => setEditing(null)} />}
      {sharing && <ShareModal onClose={() => setSharing(false)} />}
    </div>
  );
}

function MemberModal({ m, onClose }: { m: Member | null; onClose: () => void }) {
  const [name, setName] = useState(m?.name ?? '');
  const [role, setRole] = useState<Member['role']>(m?.role ?? 'MEMBER');
  const [remark, setRemark] = useState(m?.remark ?? '');
  const save = async () => {
    if (!name.trim()) return;
    if (m) await db.members.update(m.id, { name: name.trim(), role, remark: remark.trim() || undefined });
    else await db.members.add({ id: uid(), bookId: BOOK_ID, name: name.trim(), role, status: 'INVITED', isHidden: 0, sort: Date.now(), remark: remark.trim() || undefined });
    onClose();
  };
  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 380 }}>
        <div className="modal-head"><span style={{ fontWeight: 500, fontSize: 15 }}>{m ? '编辑成员' : '邀请成员'}</span></div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">名称</label>
            <input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">角色</label>
            <select className="select" value={role} onChange={e => setRole(e.target.value as Member['role'])}>
              {ROLES.filter(r => r[0] !== 'OWNER' || m?.role === 'OWNER').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">备注</label>
            <input className="input" value={remark} onChange={e => setRemark(e.target.value)} />
          </div>
          {!m && <div className="dim" style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.7 }}>
            这里添加的成员只在本机生效（用于标记「谁记的这笔账」）。<br />
            要让别人在自己手机上记账，请用「🔗 分享账本」生成链接发给对方。
          </div>}
          <div className="flex" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={save}>{m ? '保存' : '发送邀请'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
