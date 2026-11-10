import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BOOK_ID, type Tx } from '../db/schema';
import { useUi } from '../stores/ui';
import { monthRange, startOfDay, MS_DAY, fmtMD } from '../lib/date';
import { sumOf, dailySeries, categoryTotals, rollupToParents, monthInsight } from '../lib/stats';
import { fmt } from '../lib/money';
import { Chart, baseTooltip } from '../components/Chart';
import { IconEye } from '../components/icons';

function Money({ v, className }: { v: number; className?: string }) {
  const privacy = useUi(s => s.privacy);
  return <span className={`num ${className ?? ''}`}>{privacy ? '****' : fmt(v)}</span>;
}

export default function Dashboard() {
  const privacy = useUi(s => s.privacy);
  const togglePrivacy = useUi(s => s.togglePrivacy);
  const now = new Date();
  const [ms, me] = monthRange(now.getFullYear(), now.getMonth());
  const [ps, pe] = monthRange(now.getFullYear(), now.getMonth() - 1);
  /* 上月同期：上个月 1 号到上月同日，保证环比公平 */
  const prevSameEnd = Math.min(pe, new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1).getTime());

  const monthTxs = useLiveQuery(() => db.txs.where('[bookId+occurredAt]').between([BOOK_ID, ms], [BOOK_ID, me]).toArray()) ?? [];
  const prevTxs = useLiveQuery(() => db.txs.where('[bookId+occurredAt]').between([BOOK_ID, ps], [BOOK_ID, prevSameEnd], true, false).toArray(), [ps, prevSameEnd]) ?? [];
  const yearTxs = useLiveQuery(() => db.txs.where('[bookId+occurredAt]').between([BOOK_ID, new Date(now.getFullYear(), 0, 1).getTime()], [BOOK_ID, me]).toArray()) ?? [];
  const categories = useLiveQuery(() => db.categories.where('bookId').equals(BOOK_ID).toArray()) ?? [];

  const totalEx = sumOf(monthTxs, 'EXPENSE');
  const totalIn = sumOf(monthTxs, 'INCOME');
  const balance = totalIn - totalEx;

  const series = useMemo(() => dailySeries(monthTxs, ms, me), [monthTxs, ms, me]);

  const expenseTop = useMemo(() => rollupToParents(categoryTotals(monthTxs, 'EXPENSE'), categories).slice(0, 5), [monthTxs, categories]);
  const incomeTop = useMemo(() => rollupToParents(categoryTotals(monthTxs, 'INCOME'), categories), [monthTxs, categories]);
  const catName = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  /* 今天 / 本周 / 本年 */
  const today = startOfDay(Date.now());
  const todayTx = monthTxs.filter(t => startOfDay(t.occurredAt) === today);
  const weekStart = today - ((new Date().getDay() + 6) % 7) * MS_DAY;
  const weekTx = monthTxs.filter(t => startOfDay(t.occurredAt) >= weekStart);
  const periodCard = (title: string, sub: string, txs: Tx[]) => (
    <div className="stat-line" key={title}>
      <div className="cat-icon" style={{ background: 'var(--primary-50)' }}>📅</div>
      <div className="flex-1">
        <div style={{ fontSize: 13.5 }}>{title}</div>
        <div className="muted" style={{ fontSize: 12 }}>{sub}</div>
      </div>
      <div className="right" style={{ fontSize: 12, lineHeight: 1.7 }}>
        <div className="muted">收入 <span className="num income">{useUi.getState().privacy ? '****' : fmt(sumOf(txs, 'INCOME'))}</span></div>
        <div className="muted">支出 <span className="num expense">{useUi.getState().privacy ? '****' : fmt(sumOf(txs, 'EXPENSE'))}</span></div>
      </div>
    </div>
  );

  const lineOption = useMemo(() => ({
    grid: { left: 8, right: 12, top: 26, bottom: 4, containLabel: true },
    tooltip: { ...baseTooltip, formatter: (p: any) => `${p[0].axisValue}　支出 ${fmt(p[0].value)}` },
    xAxis: {
      type: 'category', boundaryGap: false,
      data: series.map(p => fmtMD(p.date)),
      axisLabel: { fontSize: 10, color: '#9AA0A6', interval: Math.max(0, Math.floor(series.length / 5) - 1) },
      axisLine: { lineStyle: { color: '#EFEFF1' } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#9AA0A6' }, splitLine: { lineStyle: { color: '#F4F4F6' } } },
    series: [{
      type: 'line', data: series.map(p => Math.round(p.expense * 100) / 100),
      smooth: true, symbol: 'circle', symbolSize: 5, showSymbol: false,
      lineStyle: { color: '#FF8A3D', width: 2 },
      itemStyle: { color: '#FF8A3D' },
      areaStyle: { color: 'rgba(255,138,61,0.09)' },
    }],
  }), [series]);

  const insights = useMemo(() => monthInsight(monthTxs, prevTxs, categories), [monthTxs, prevTxs, categories]);

  const catRow = (id: string, total: number, count: number, color: string, type: 'EXPENSE' | 'INCOME') => {
    const c = catName.get(id);
    return (
      <div className="list-row" key={id}>
        <div className="cat-icon" style={{ background: color + '22' }}>{c?.icon || '🏷️'}</div>
        <div className="flex-1" style={{ fontSize: 13 }}>
          {c?.name ?? '未知'} <span className="muted" style={{ fontSize: 11 }}>{count} 笔</span>
        </div>
        <span className={`num ${type === 'EXPENSE' ? 'expense' : 'income'}`} style={{ fontSize: 13.5 }}>
          <Money v={total} />
        </span>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-grid page-narrow">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="hero-card">
            <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, color: '#A87953' }}>本月收支统计</span>
              <button className="btn-text" title={privacy ? '显示金额' : '隐藏金额'} aria-label={privacy ? '显示金额' : '隐藏金额'}
                onClick={togglePrivacy} style={{ color: '#A87953', opacity: privacy ? 1 : .75 }}>
                <IconEye off={privacy} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#B58658' }}>总支出</div>
            <div style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.5px' }}>
              <Money v={totalEx} />
            </div>
            <div style={{ fontSize: 12, color: '#A87953', marginTop: 6 }}>
              总收入 <Money v={totalIn} />　结余 <span className="num income"><Money v={balance} /></span>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">本月每日支出统计</span>
              <span className="card-sub">元</span>
            </div>
            <Chart option={lineOption} height={200} />
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">本月分类收入</span>
              <span className="card-sub">{monthTxs.filter(t => t.type === 'INCOME').length} 笔 · 总收入 <span className="num income"><Money v={totalIn} /></span></span>
            </div>
            {incomeTop.length
              ? incomeTop.map(c => catRow(c.categoryId, c.total, c.count, '#7ECBB5', 'INCOME'))
              : <div className="empty"><div className="empty-sub">本月还没有收入，记一笔吧</div></div>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '6px 20px' }}>
            {periodCard('今天', `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`, todayTx)}
            {periodCard('本周', `${fmtMD(weekStart)} - ${fmtMD(Math.min(weekStart + 6 * MS_DAY, me - MS_DAY))}`, weekTx)}
            {periodCard('本年', `${now.getFullYear()}年`, yearTxs)}
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">本月分类支出</span>
              <span className="card-sub">{monthTxs.filter(t => t.type === 'EXPENSE').length} 笔 · 总支出 <span className="num expense"><Money v={totalEx} /></span></span>
            </div>
            {expenseTop.length
              ? expenseTop.map((c, i) => catRow(c.categoryId, c.total, c.count, ['#FF8A3D', '#FFC46B', '#7BA7E8', '#C89BE8', '#7ECBB5'][i % 5], 'EXPENSE'))
              : <div className="empty"><div className="empty-sub">本月还没有支出</div></div>}
          </div>

          <div className="insight">
            <div className="insight-title">本月洞察</div>
            {insights.map((s, i) => <div className="insight-body" key={i} style={{ marginBottom: i < insights.length - 1 ? 6 : 0 }}>{s}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
