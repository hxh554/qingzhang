export const MS_DAY = 86400000;

export function startOfDay(d: Date | number): number {
  const t = new Date(d);
  return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
}
export function endOfDay(d: Date | number): number {
  return startOfDay(d) + MS_DAY;
}
/** 月份范围 [start, end) */
export function monthRange(year: number, month0: number): [number, number] {
  return [new Date(year, month0, 1).getTime(), new Date(year, month0 + 1, 1).getTime()];
}
export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}
export function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}
export function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
export function fmtMonth(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
export function fmtTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export function fmtWeekday(ms: number): string {
  return WEEK[new Date(ms).getDay()];
}
export function fmtMD(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
