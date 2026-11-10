import { useState } from 'react';
import { useRoute, navigate } from '../lib/router';
import { useUi } from '../stores/ui';
import { IconHome, IconList, IconChart, IconTag, IconSettings, IconPlus, IconChevron, IconMenu } from './icons';

const MAIN = [
  { path: '/', label: '首页', Icon: IconHome },
  { path: '/tx', label: '流水', Icon: IconList },
  { path: '/reports/base', label: '报表', Icon: IconChart },
];

const GROUP = [
  { path: '/categories', label: '收支分类' },
  { path: '/accounts', label: '账户管理' },
  { path: '/members', label: '成员管理' },
  { path: '/merchants', label: '商家管理' },
  { path: '/projects', label: '项目管理' },
];

export function Sidebar() {
  const route = useRoute();
  const openQuickAdd = useUi(s => s.openQuickAdd);
  const navOpen = useUi(s => s.navOpen);
  const closeNav = useUi(s => s.closeNav);
  const [groupOpen, setGroupOpen] = useState(true);
  const inGroup = GROUP.some(g => route.startsWith(g.path));

  const go = (path: string) => { navigate(path); closeNav(); };

  const item = (path: string, label: string, Icon?: any) => {
    const active = route === path || (path !== '/' && path !== '/tx' && route.startsWith(path));
    return (
      <button key={path} className={`nav-item${active ? ' active' : ''}`}
        onClick={() => go(path)}>
        {Icon && <Icon />}{label}
      </button>
    );
  };

  return (
    <aside className={`sidebar${navOpen ? ' open' : ''}`}>
      <div className="sidebar-brand">
        <span className="brand-mark">¥</span>
        <span className="brand-name">轻账</span>
        <button className="sheet-close" onClick={closeNav} aria-label="关闭菜单">✕</button>
      </div>

      <button className="add-btn" onClick={() => openQuickAdd('EXPENSE')}>
        <IconPlus /> 记一笔
      </button>
      <nav className="nav">
        {MAIN.map(({ path, label, Icon }) => item(path, label, Icon))}
        <button className={`nav-item${inGroup ? ' active' : ''}`}
          onClick={() => setGroupOpen(v => !v)}>
          <IconTag /> 分类标签
          <span className={`chev${groupOpen ? ' open' : ''}`}><IconChevron /></span>
        </button>
        {groupOpen && <div className="nav-group">{GROUP.map(g => item(g.path, g.label))}</div>}
      </nav>
      <div className="sidebar-foot">{item('/settings', '设置', IconSettings)}</div>
    </aside>
  );
}
