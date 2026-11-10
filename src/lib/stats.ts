import type { Tx, Account, Category } from '../db/schema';
import { startOfDay, MS_DAY, daysInMonth } from './date';

export function sumOf(txs: Tx[], type: Tx['type']): number {
  let s = 0;
  for (const t of txs) if (t.type === type) s += t.amount;
  return s;
}

export interface DayPoint { date: number; expense: number; income: number; }

/** 每日收支序列 [start, end) */
export function dailySeries(txs: Tx[], start: number, end: number): DayPoint[] {
  const days = Math.round((end - start) / MS_DAY);
  const map = new Map<number, DayPoint>();
  for (let i = 0; i < days; i++) {
    map.set(start + i * MS_DAY, { date: start + i * MS_DAY, expense: 0, income: 0 });
  }
  for (const t of txs) {
    const key = startOfDay(t.occurredAt);
    const p = map.get(key);
    if (!p) continue;
    if (t.type === 'EXPENSE') p.expense += t.amount;
    else if (t.type === 'INCOME') p.income += t.amount;
  }
  return [...map.values()];
}

export interface CatTotal { categoryId: string; total: number; count: number; }

export function categoryTotals(txs: Tx[], type: 'EXPENSE' | 'INCOME'): CatTotal[] {
  const map = new Map<string, CatTotal>();
  for (const t of txs) {
    if (t.type !== type || !t.categoryId) continue;
    const cur = map.get(t.categoryId) ?? { categoryId: t.categoryId, total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    map.set(t.categoryId, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** 把二级分类总额归并到一级分类 */
export function rollupToParents(totals: CatTotal[], categories: Category[]): CatTotal[] {
  const byId = new Map(categories.map(c => [c.id, c]));
  const out = new Map<string, CatTotal>();
  for (const t of totals) {
    const c = byId.get(t.categoryId);
    if (!c) continue;
    const top = c.parentId ? byId.get(c.parentId) : c;
    if (!top) continue;
    const cur = out.get(top.id) ?? { categoryId: top.id, total: 0, count: 0 };
    cur.total += t.total;
    cur.count += t.count;
    out.set(top.id, cur);
  }
  return [...out.values()].sort((a, b) => b.total - a.total);
}

export interface EntityTotal { id: string; total: number; count: number; }

export function groupTotals(txs: Tx[], type: Tx['type'], keyFn: (t: Tx) => string | undefined): EntityTotal[] {
  const map = new Map<string, EntityTotal>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const k = keyFn(t);
    if (!k) continue;
    const cur = map.get(k) ?? { id: k, total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** 账户余额（含 ADJUST） */
export function accountBalance(accountId: string, txs: Tx[], initBalance: number): number {
  let b = initBalance;
  for (const t of txs) {
    if (t.type === 'INCOME' && t.accountId === accountId) b += t.amount;
    else if (t.type === 'EXPENSE' && t.accountId === accountId) b -= t.amount;
    else if (t.type === 'TRANSFER') {
      if (t.accountId === accountId) b -= t.amount;
      if (t.toAccountId === accountId) b += t.amount;
    } else if (t.type === 'ADJUST' && t.accountId === accountId) b += t.amount;
  }
  return Math.round(b * 100) / 100;
}

export function netWorth(accounts: Account[], txs: Tx[]) {
  let assets = 0, liabilities = 0;
  for (const a of accounts) {
    const b = accountBalance(a.id, txs, a.initBalance);
    /* 负债账户：支出会让余额变负，欠款额取正 */
    if (a.isLiability) liabilities += -b;
    else if (a.includeInAssets) assets += b;
  }
  return { assets, liabilities, net: assets - liabilities };
}

/** 月度洞察（规则引擎） */
export function monthInsight(cur: Tx[], prev: Tx[], categories: Category[]): string[] {
  const lines: string[] = [];
  const curEx = sumOf(cur, 'EXPENSE');
  const prevEx = sumOf(prev, 'EXPENSE');
  if (prevEx > 0) {
    const diff = curEx - prevEx;
    const pct = Math.round((diff / prevEx) * 100);
    if (Math.abs(pct) >= 5) {
      lines.push(`本月支出比上月同期${diff > 0 ? '多' : '少'} ${Math.abs(pct)}%${diff > 0 ? '，注意控制节奏' : '，存钱势头不错'}。`);
    } else {
      lines.push('本月支出与上月同期基本持平，消费节奏稳定。');
    }
  }
  const curCat = rollupToParents(categoryTotals(cur, 'EXPENSE'), categories);
  const prevCat = rollupToParents(categoryTotals(prev, 'EXPENSE'), categories);
  const prevMap = new Map(prevCat.map(c => [c.categoryId, c.total]));
  let worst: { name: string; diff: number } | null = null;
  const catName = new Map(categories.map(c => [c.id, c.name]));
  for (const c of curCat) {
    const d = c.total - (prevMap.get(c.categoryId) ?? 0);
    if (!worst || d > worst.diff) worst = { name: catName.get(c.categoryId) ?? '', diff: d };
  }
  if (worst && worst.diff > 50) {
    lines.push(`${worst.name}比上月同期多花 ${Math.round(worst.diff)} 元，是支出增长最大的一项。`);
  }
  if (curEx > 0) {
    const days = new Set(cur.map(t => startOfDay(t.occurredAt))).size || 1;
    lines.push(`本月已记账 ${days} 天，日均支出 ${Math.round(curEx / days)} 元。`);
  }
  if (!lines.length) lines.push('记账满一个月后，这里会出现你的第一份消费洞察。');
  return lines;
}
