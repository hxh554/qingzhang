import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, BOOK_ID } from '../db/schema';
import { monthRange, fmtMonth } from '../lib/date';
import { sumOf, categoryTotals, groupTotals, accountBalance, netWorth, dailySeries } from '../lib/stats';
import { fmt } from '../lib/money';
import { Chart, PALETTE, baseTooltip } from '../components/Chart';
import { MonthPicker } from '../components/MonthPicker';
import { useUi } from '../stores/ui';

const TABS = [
  ['base', '基础统计'], ['category', '分类'], ['account', '账户'],
  ['member', '成员'], ['project', '项目'], ['merchant', '商家'],
] as const;

export default function Reports() {
  const now = new Date();
  const privacy = useUi(s => s.privacy);
  const mask = (v: number) => (privacy ? '****' : fmt(v));
  const [tab, setTab] = useState<string>('base');
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [ms, me] = monthRange(ym.y, ym.m);
  const [ys, ye] = [new Date(ym.y, 0, 1).getTime(), new Date(ym.y + 1, 0, 1).getTime()];

  const monthTxs = useLiveQuery(() => db.txs.where('[bookId+occurredAt]').between([BOOK_ID, ms], [BOOK_ID, me]).toArray(), [ms, me]) ?? [];
  const yearTxs = useLiveQuery(() => db.txs.where('[bookId+occurredAt]').between([BOOK_ID, ys], [BOOK_ID, ye]).toArray(), [ys, ye]) ?? [];
  const categories = useLiveQuery(() => db.categories.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const accounts = useLiveQuery(() => db.accounts.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const members = useLiveQuery(() => db.members.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const projects = useLiveQuery(() => db.projects.where('bookId').equals(BOOK_ID).toArray()) ?? [];
  const merchants = useLiveQuery(() => db.merchants.where('bookId').equals(BOOK_ID).toArray()) ?? [];

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const memMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);
  const projMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const merchMap = useMemo(() => new Map(merchants.map(m => [m.id, m])), [merchants]);

  const donut = (data: { name: string; value: number }[], centerText?: string) => ({
    color: PALETTE,
    tooltip: { trigger: 'item', formatter: '{b}<br/>¥{c}（{d}%）' },
    series: [{
      type: 'pie', radius: ['52%', '76%'], center: ['50%', '50%'],
      data, label: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
      emphasis: { scaleSize: 4 },
    }],
    graphic: centerText ? [{
      type: 'text', left: 'center', top: 'center',
      style: { text: centerText, fontSize: 14, fontWeight: 500, fill: '#1F2329', fontFamily: 'inherit' },
    }] : undefined,
  });

  /* ===== 基础统计 ===== */
  const totalEx = sumOf(monthTxs, 'EXPENSE');
  const totalIn = sumOf(monthTxs, 'INCOME');
  const balance = totalIn - totalEx;

  const yearSeries = useMemo(() => {
    const arr: { m: string; income: number; expense: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const [a, b] = monthRange(ym.y, i);
      const t = yearTxs.filter(t => t.occurredAt >= a && t.occurredAt < b);
      arr.push({ m: `${i + 1}月`, income: sumOf(t, 'INCOME'), expense: sumOf(t, 'EXPENSE') });
    }
    return arr;
  }, [yearTxs, ym.y]);

  const trendOption = useMemo(() => ({
    grid: { left: 8, right: 12, top: 30, bottom: 4, containLabel: true },
    tooltip: baseTooltip,
    legend: {
      data: ['收入', '支出'], top: 0, right: 0, icon: 'circle', itemWidth: 8,
      textStyle: { color: '#5A5F66', fontSize: 12 },
    },
    xAxis: {
      type: 'category', data: yearSeries.map(d => d.m),
      axisLabel: { fontSize: 10, color: '#9AA0A6' },
      axisLine: { lineStyle: { color: '#EFEFF1' } }, axisTick: { show: false },
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#9AA0A6' }, splitLine: { lineStyle: { color: '#F4F4F6' } } },
    series: [
      { name: '收入', type: 'bar', data: yearSeries.map(d => d.income), itemStyle: { color: '#2FBFA8', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14 },
      { name: '支出', type: 'bar', data: yearSeries.map(d => d.expense), itemStyle: { color: '#FF8A3D', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14 },
    ],
  }), [yearSeries]);

  const dailyData = useMemo(() => dailySeries(monthTxs, ms, me), [monthTxs, ms, me]);
  const dailyOption = useMemo(() => ({
    grid: { left: 8, right: 16, top: 34, bottom: 4, containLabel: true },
    tooltip: baseTooltip,
    legend: { data: ['收入', '支出'], top: 0, left: 0, icon: 'circle', itemWidth: 8, textStyle: { color: '#5A5F66', fontSize: 12 } },
    xAxis: {
      type: 'category', boundaryGap: false,
      data: dailyData.map(p => String(new Date(p.date).getDate())),
      axisLabel: { fontSize: 10, color: '#9AA0A6' },
      axisLine: { lineStyle: { color: '#EFEFF1' } }, axisTick: { show: false },
    },
    yAxis: [
      { type: 'value', axisLabel: { fontSize: 10, color: '#FF8A3D' }, splitLine: { lineStyle: { color: '#F4F4F6' } } },
      { type: 'value', axisLabel: { fontSize: 10, color: '#2FBFA8' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '支出', type: 'line', smooth: true, showSymbol: false,
        data: dailyData.map(p => Math.round(p.expense * 100) / 100),
        lineStyle: { color: '#FF8A3D', width: 2 }, itemStyle: { color: '#FF8A3D' },
        areaStyle: { color: 'rgba(255,138,61,0.07)' },
      },
      {
        name: '收入', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1,
        data: dailyData.map(p => Math.round(p.income * 100) / 100),
        lineStyle: { color: '#2FBFA8', width: 2 }, itemStyle: { color: '#2FBFA8' },
      },
    ],
  }), [dailyData]);

  /* 分类 / 账户 / 成员 / 项目 / 商家统计 */
  const catName = (id?: string) => { const c = id ? catMap.get(id) : undefined; if (!c) return '未分类'; const p = c.parentId ? catMap.get(c.parentId) : undefined; return p ? `${p.name}·${c.name}` : c.name; };
  const catRows = (list: { categoryId: string; total: number; count: number }[]) =>
    list.map(c => ({ id: c.categoryId, total: c.total, count: c.count }));

  const expCats = useMemo(() => categoryTotals(monthTxs, 'EXPENSE'), [monthTxs]);
  const incCats = useMemo(() => categoryTotals(monthTxs, 'INCOME'), [monthTxs]);
  const donutData = (list: typeof expCats, namer: (id: string) => string) =>
    list.slice(0, 10).map((c, i) => ({ name: namer(c.categoryId), value: Math.round(c.total * 100) / 100, itemStyle: { color: PALETTE[i % PALETTE.length] } }));

  const nw = useMemo(() => netWorth(accounts, yearTxs), [accounts, yearTxs]);
  const assetList = useMemo(() =>
    accounts.filter(a => !a.isLiability)
      .map(a => ({ id: a.id, name: a.name, icon: a.icon, value: accountBalance(a.id, yearTxs, a.initBalance) }))
      .filter(a => a.value > 0)
      .sort((a, b) => b.value - a.value)
  , [accounts, yearTxs]);
  const assetSum = assetList.reduce((s, a) => s + a.value, 0);

  const assetDonut = useMemo(() => ({
    color: PALETTE,
    tooltip: { trigger: 'item', formatter: '{b}<br/>¥{c}（{d}%）' },
    series: [{
      type: 'pie', radius: ['52%', '76%'],
      data: assetList.map((a, i) => ({ name: a.name, value: Math.round(a.value * 100) / 100, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      label: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
    }],
    graphic: [{
      type: 'text', left: 'center', top: 'center',
      style: { text: mask(assetSum), fontSize: 15, fontWeight: 500, fill: '#1F2329', fontFamily: 'inherit' },
    }],
  }), [assetList, assetSum, privacy]);

  const memberStats = useMemo(() => groupTotals(monthTxs, 'EXPENSE', t => t.memberId), [monthTxs]);
  const projectStats = useMemo(() => groupTotals(monthTxs, 'EXPENSE', t => t.projectId), [monthTxs]);
  const merchantStats = useMemo(() => groupTotals(monthTxs, 'EXPENSE', t => t.merchantId), [monthTxs]);

  const TopList = ({ rows, namer }: { rows: { id: string; total: number; count: number }[]; namer: (id: string) => string }) => (
    <div>
      {rows.map((r, i) => (
        <div className="list-row" key={r.id}>
          <span className="muted num" style={{ width: 16, fontSize: 12 }}>{i + 1}</span>
          <div className="flex-1" style={{ fontSize: 13 }}>{namer(r.id)} <span className="muted" style={{ fontSize: 11 }}>{r.count} 笔</span></div>
          <span className="num" style={{ fontSize: 13.5 }}>{fmt(r.total)}</span>
        </div>
      ))}
      {!rows.length && <div className="empty" style={{ padding: 24 }}><div className="empty-sub">本月暂无数据</div></div>}
    </div>
  );

  return (
    <div className="page">
      <div className="page-narrow" style={{ maxWidth: 1200 }}>
        <div className="flex report-top" style={{ marginBottom: 4 }}>
          <div className="tabs" style={{ flex: 1, marginBottom: 0 }}>
            {TABS.map(([k, label]) => (
              <button key={k} className={`tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          <MonthPicker y={ym.y} m={ym.m} onChange={(yy, mm) => setYm({ y: yy, m: mm })} />
        </div>

        {tab === 'base' && (
          <div className="page-grid" style={{ gridTemplateColumns: '420px 1fr', marginTop: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="hero-card" style={{ background: 'linear-gradient(135deg, #E8F8F2, #FFF4ED)' }}>
                <div style={{ fontSize: 12.5, color: '#7B9A8D', marginBottom: 8 }}>账本流水统计 · {fmtMonth(ms)}</div>
                <div style={{ fontSize: 12, color: '#8A9A92' }}>结余</div>
                <div style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.2 }}><span className={`num ${balance >= 0 ? 'income' : 'expense'}`}>{fmt(balance)}</span></div>
                <div style={{ fontSize: 12, color: '#8A9A92', marginTop: 6 }}>
                  总收入 <span className="num income">{fmt(totalIn)}</span>　总支出 <span className="num expense">{fmt(totalEx)}</span>
                </div>
                <div className="list-row" style={{ marginTop: 10, borderColor: 'rgba(0,0,0,.05)' }}>
                  <span style={{ fontSize: 13 }}>📒 记账里程碑</span>
                  <div className="flex-1" />
                  <span className="card-sub">记账笔数 <b className="num">{monthTxs.length}</b></span>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><span className="card-title">支出分布</span></div>
                <TopList rows={catRows(expCats).slice(0, 5)} namer={id => catName(id)} />
              </div>

              <div className="card">
                <div className="card-head">
                  <span className="card-title">资产类账户统计</span>
                  <span className="card-sub">净资产 <span className="num">{fmt(nw.net)}</span></span>
                </div>
                <Chart option={assetDonut} height={200} />
                <div className="mt-8">
                  {assetList.map((a, i) => (
                    <div className="list-row" key={a.id}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
                      <div className="flex-1" style={{ fontSize: 12.5 }}>{a.icon} {a.name}</div>
                      <span className="num" style={{ fontSize: 12.5 }}>{fmt(a.value)}</span>
                      <span className="muted num" style={{ fontSize: 11, width: 40, textAlign: 'right' }}>
                        {assetSum > 0 ? Math.round((a.value / assetSum) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-head"><span className="card-title">月度收支趋势 · {ym.y}年</span></div>
                <Chart option={trendOption} height={240} />
              </div>
              <div className="card">
                <div className="card-head">
                  <span className="card-title">每日收支 · {fmtMonth(ms)}</span>
                </div>
                <Chart option={dailyOption} height={240} />
              </div>
            </div>
          </div>
        )}

        {tab === 'category' && (
          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="card-head">
                <span className="card-title">支出分类统计</span>
                <span className="card-sub">总支出 <span className="num expense">{fmt(totalEx)}</span></span>
              </div>
              {expCats.length ? <Chart option={donut(donutData(expCats, id => catName(id)), mask(totalEx))} height={230} /> : <div className="empty"><div className="empty-sub">暂无数据</div></div>}
              <div className="mt-16"><TopList rows={catRows(expCats)} namer={id => catName(id)} /></div>
            </div>
            <div className="card">
              <div className="card-head">
                <span className="card-title">收入分类统计</span>
                <span className="card-sub">总收入 <span className="num income">{fmt(totalIn)}</span></span>
              </div>
              {incCats.length ? <Chart option={donut(donutData(incCats, id => catName(id)), mask(totalIn))} height={230} /> : <div className="empty"><div className="empty-sub">暂无数据</div></div>}
              <div className="mt-16"><TopList rows={catRows(incCats)} namer={id => catName(id)} /></div>
            </div>
          </div>
        )}

        {tab === 'account' && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head">
              <span className="card-title">账户余额</span>
              <span className="card-sub">净资产 <span className="num">{fmt(nw.net)}</span> · 总资产 <span className="num">{fmt(nw.assets)}</span> · 总负债 <span className="num">{fmt(nw.liabilities)}</span></span>
            </div>
            <Chart option={{
              grid: { left: 8, right: 24, top: 10, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>余额 ¥${fmt(p[0].value)}` },
              xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#9AA0A6' }, splitLine: { lineStyle: { color: '#F4F4F6' } } },
              yAxis: {
                type: 'category',
                data: accounts.map(a => a.name).reverse(),
                axisLabel: { fontSize: 12, color: '#5A5F66' }, axisLine: { show: false }, axisTick: { show: false },
              },
              series: [{
                type: 'bar', barMaxWidth: 18,
                data: accounts.map(a => accountBalance(a.id, yearTxs, a.initBalance)).reverse(),
                itemStyle: { borderRadius: [0, 4, 4, 0] },
              }],
            }} height={Math.max(200, accounts.length * 44)} />
            <div className="mt-16">
              {accounts.map(a => {
                const b = accountBalance(a.id, yearTxs, a.initBalance);
                return (
                  <div className="list-row" key={a.id}>
                    <div className="cat-icon" style={{ background: 'var(--bg)' }}>{a.icon}</div>
                    <div className="flex-1" style={{ fontSize: 13 }}>{a.name} <span className="pill">{a.isLiability ? '负债' : '资产'}</span></div>
                    <span className={`num ${b < 0 ? 'expense' : ''}`}>{fmt(b)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'member' && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head"><span className="card-title">成员支出对比 · {fmtMonth(ms)}</span></div>
            <Chart option={{
              grid: { left: 8, right: 24, top: 10, bottom: 4, containLabel: true },
              tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>支出 ¥${fmt(p[0].value)}` },
              xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#9AA0A6' }, splitLine: { lineStyle: { color: '#F4F4F6' } } },
              yAxis: { type: 'category', data: memberStats.map(r => memMap.get(r.id)?.name ?? '').reverse(), axisLabel: { fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
              series: [{ type: 'bar', barMaxWidth: 18, data: memberStats.map(r => r.total).reverse(), itemStyle: { color: '#FF8A3D', borderRadius: [0, 4, 4, 0] } }],
            }} height={Math.max(180, memberStats.length * 50)} />
            <div className="mt-16"><TopList rows={memberStats} namer={id => memMap.get(id)?.name ?? '未知'} /></div>
          </div>
        )}

        {tab === 'project' && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head"><span className="card-title">项目支出排行 · {fmtMonth(ms)}</span></div>
            <TopList rows={projectStats} namer={id => projMap.get(id)?.name ?? '未知'} />
          </div>
        )}

        {tab === 'merchant' && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head"><span className="card-title">商家消费排行 · {fmtMonth(ms)}</span></div>
            <TopList rows={merchantStats} namer={id => merchMap.get(id)?.name ?? '未知'} />
          </div>
        )}
      </div>
    </div>
  );
}
