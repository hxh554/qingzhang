import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BOOK_ID } from '../db/schema';
import { resetDemoData, clearAllData, markSeeded } from '../db/seed';
import { fmtDate } from '../lib/date';
import { IconDownload, IconUpload } from '../components/icons';
import { CloudPanel } from '../components/CloudPanel';
import { cloudEnabled } from '../lib/cloud';
import { wipeCloud } from '../lib/sync';

export default function Settings() {
  const book = useLiveQuery(() => db.books.get(BOOK_ID));
  const txCount = useLiveQuery(() => db.txs.where('bookId').equals(BOOK_ID).count()) ?? 0;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const exportJson = async () => {
    const data = {
      version: 1, exportedAt: new Date().toISOString(),
      books: await db.books.toArray(),
      members: await db.members.toArray(),
      categories: await db.categories.toArray(),
      accounts: await db.accounts.toArray(),
      projects: await db.projects.toArray(),
      merchants: await db.merchants.toArray(),
      txs: await db.txs.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    download(blob, `轻账备份-${new Date().toISOString().slice(0, 10)}.json`);
    setMsg('已导出 JSON 备份');
  };

  const exportCsv = async () => {
    const cats = await db.categories.toArray();
    const accs = await db.accounts.toArray();
    const catName = new Map(cats.map(c => [c.id, c.name]));
    const accName = new Map(accs.map(a => [a.id, a.name]));
    const rows = [['类型', '金额', '分类', '账户', '转入账户', '时间', '备注']];
    for (const t of await db.txs.where('bookId').equals(BOOK_ID).toArray()) {
      rows.push([
        t.type === 'EXPENSE' ? '支出' : t.type === 'INCOME' ? '收入' : t.type === 'TRANSFER' ? '转账' : '调整',
        String(t.amount),
        t.categoryId ? (catName.get(t.categoryId) ?? '') : '',
        accName.get(t.accountId) ?? '',
        t.toAccountId ? (accName.get(t.toAccountId) ?? '') : '',
        new Date(t.occurredAt).toLocaleString('zh-CN'),
        t.remark ?? '',
      ]);
    }
    const csv = '\ufeff' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    download(new Blob([csv], { type: 'text/csv' }), `轻账流水-${new Date().toISOString().slice(0, 10)}.csv`);
    setMsg('已导出 CSV 流水');
  };

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data.txs || !data.books) { setMsg('文件格式不对：需要轻账导出的 JSON 备份'); return; }
      if (!confirm(`导入备份（${data.txs.length} 笔流水）将覆盖当前全部数据，继续？`)) return;
      await db.transaction('rw', [db.books, db.members, db.categories, db.accounts, db.projects, db.merchants, db.txs], async () => {
        await Promise.all([db.books.clear(), db.members.clear(), db.categories.clear(), db.accounts.clear(), db.projects.clear(), db.merchants.clear(), db.txs.clear()]);
        await db.books.bulkAdd(data.books);
        if (data.members?.length) await db.members.bulkAdd(data.members);
        if (data.categories?.length) await db.categories.bulkAdd(data.categories);
        if (data.accounts?.length) await db.accounts.bulkAdd(data.accounts);
        if (data.projects?.length) await db.projects.bulkAdd(data.projects);
        if (data.merchants?.length) await db.merchants.bulkAdd(data.merchants);
        await db.txs.bulkAdd(data.txs);
      });
      setMsg(`导入成功：${data.txs.length} 笔流水`);
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      setMsg('导入失败：' + (e as Error).message);
    }
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 16 }}>账本设置</div>
          <div className="flex gap-12" style={{ marginBottom: 14 }}>
            <div className="book-cover" style={{ width: 52, height: 52, borderRadius: 12, fontSize: 26, background: 'linear-gradient(135deg,#FFB37D,#FF8A3D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{book?.cover ?? '📔'}</div>
            <div>
              <div style={{ fontWeight: 500 }}>{book?.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                创建时间 {book ? fmtDate(book.createdAt) : '-'}　·　流水 {txCount} 笔
              </div>
            </div>
          </div>
        </div>

        <CloudPanel />

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="flex gap-8" style={{ marginBottom: 8 }}><IconDownload /> <b style={{ fontWeight: 500 }}>导出数据</b></div>
            <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.7, marginBottom: 12 }}>导出完整备份（JSON）或流水表格（CSV，可用 Excel 打开）。</div>
            <div className="flex gap-8">
              <button className="btn btn-ghost" onClick={exportJson}>JSON 备份</button>
              <button className="btn btn-ghost" onClick={exportCsv}>CSV 流水</button>
            </div>
          </div>
          <div className="card">
            <div className="flex gap-8" style={{ marginBottom: 8 }}><IconUpload /> <b style={{ fontWeight: 500 }}>导入数据</b></div>
            <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.7, marginBottom: 12 }}>导入轻账导出的 JSON 备份，将覆盖当前数据。</div>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>选择备份文件</button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          </div>
        </div>

        <div className="card">
          <b style={{ fontWeight: 500 }}>数据管理</b>
          <div className="dim" style={{ fontSize: 12.5, margin: '8px 0 12px' }}>数据全部保存在本机浏览器（IndexedDB），不会上传到任何服务器。</div>
          {msg && <div className="pill orange" style={{ display: 'inline-block', marginBottom: 12 }}>{msg}</div>}
          <div className="flex gap-8">
            <button className="btn btn-ghost" onClick={async () => {
              if (confirm('重置为演示数据？当前数据将被覆盖。')) {
                if (cloudEnabled) await wipeCloud();
                await resetDemoData();
                if (cloudEnabled) location.reload();
                setMsg('已重置为演示数据');
              }
            }}>重置演示数据</button>
            <button className="btn btn-ghost" style={{ color: 'var(--expense)' }} onClick={async () => {
              if (confirm('清空全部数据？此操作不可恢复！') && confirm('再次确认：真的要清空全部数据吗？')) {
                if (cloudEnabled) await wipeCloud();
                await clearAllData();
                markSeeded();
                location.reload();
              }
            }}>清空全部数据</button>
          </div>
        </div>
      </div>
    </div>
  );
}
