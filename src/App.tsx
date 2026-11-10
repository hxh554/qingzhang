import { useEffect, useState } from 'react';
import { useRoute } from './lib/router';
import { useUi } from './stores/ui';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { TabBar } from './components/TabBar';
import { QuickAddModal } from './components/QuickAddModal';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Categories from './pages/Categories';
import Accounts from './pages/Accounts';
import Members from './pages/Members';
import Merchants from './pages/Merchants';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import Join from './pages/Join';
import Login from './pages/Login';
import { cloudEnabled, supabase } from './lib/cloud';
import { ensureBook } from './lib/sync';
import { useSync } from './stores/sync';

export default function App() {
  const route = useRoute();
  const { openQuickAdd, quickAddOpen, closeQuickAdd, navOpen, closeNav } = useUi();
  const [authed, setAuthed] = useState<boolean | null>(cloudEnabled ? null : true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape') {
        if (quickAddOpen) { closeQuickAdd(); return; }
        if (navOpen) { closeNav(); return; }
      }
      if (typing) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openQuickAdd('EXPENSE'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickAddOpen, navOpen]);

  /* 切路由时收起手机端抽屉 */
  useEffect(() => { closeNav(); }, [route]);

  /* 云端模式：先确认会话，再把账本绑好（拉全量 + 订阅实时） */
  useEffect(() => {
    if (!cloudEnabled || !supabase) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (!data.session) { setAuthed(false); return; }
      useSync.getState().set({ email: data.session.user.email ?? null });
      try {
        await ensureBook();
      } catch (e) {
        console.error('[cloud] 绑定账本失败', e);
      }
      if (!alive) return;
      useSync.getState().set({ ready: true });
      setAuthed(true);
    })();
    return () => { alive = false; };
  }, []);

  if (route.startsWith('/join/')) return <Join code={route.slice('/join/'.length)} />;

  if (authed === null) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <span className="dim">正在连接云端…</span>
      </div>
    );
  }

  if (authed === false) return <Login onDone={() => setAuthed(true)} />;

  let page;
  if (route.startsWith('/tx')) page = <Transactions />;
  else if (route.startsWith('/reports')) page = <Reports />;
  else if (route.startsWith('/categories')) page = <Categories />;
  else if (route.startsWith('/accounts')) page = <Accounts />;
  else if (route.startsWith('/members')) page = <Members />;
  else if (route.startsWith('/merchants')) page = <Merchants />;
  else if (route.startsWith('/projects')) page = <Projects />;
  else if (route.startsWith('/settings')) page = <Settings />;
  else page = <Dashboard />;

  return (
    <div className={`app${quickAddOpen ? ' has-modal' : ''}${navOpen ? ' has-nav' : ''}`}>
      <Sidebar />
      {navOpen && <div className="nav-mask" onClick={closeNav} />}
      <div className="main">
        <Topbar />
        {page}
      </div>
      <TabBar />
      <QuickAddModal />
    </div>
  );
}
