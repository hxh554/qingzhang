import { useRoute, navigate } from '../lib/router';
import { useUi } from '../stores/ui';
import { IconHome, IconList, IconChart, IconDots, IconPlus } from './icons';

/** 手机端底部导航（PC 端由 CSS 隐藏） */
export function TabBar() {
  const route = useRoute();
  const openQuickAdd = useUi(s => s.openQuickAdd);
  const toggleNav = useUi(s => s.toggleNav);

  const on = (p: string) => (p === '/' ? route === '/' : route.startsWith(p));

  return (
    <nav className="tabbar">
      <button className={`tab-item${on('/') ? ' on' : ''}`} onClick={() => navigate('/')}>
        <IconHome /><span>首页</span>
      </button>
      <button className={`tab-item${on('/tx') ? ' on' : ''}`} onClick={() => navigate('/tx')}>
        <IconList /><span>流水</span>
      </button>

      <button className="tab-add" onClick={() => openQuickAdd('EXPENSE')} aria-label="记一笔">
        <IconPlus />
      </button>

      <button className={`tab-item${on('/reports') ? ' on' : ''}`} onClick={() => navigate('/reports/base')}>
        <IconChart /><span>报表</span>
      </button>
      <button className="tab-item" onClick={toggleNav}>
        <IconDots /><span>更多</span>
      </button>
    </nav>
  );
}
