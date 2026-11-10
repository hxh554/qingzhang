/* 金额格式化：分为单位的思考不需要——直接用元，保留两位 */
export function fmt(n: number, withSign = false): string {
  const neg = n < 0;
  const s = Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (withSign) return (neg ? '-' : '+') + s;
  return (neg ? '-' : '') + s;
}

/* 计算金额输入表达式 "35+20-5" */
export function evalAmount(raw: string): number | null {
  const s = raw.replace(/[，,￥¥\s]/g, '');
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if (!/^[-+*/.\d]+$/.test(s)) return null;
  try {
    const v = new Function(`return (${s})`)();
    if (typeof v === 'number' && isFinite(v) && v >= 0) return Math.round(v * 100) / 100;
  } catch { /* ignore */ }
  return null;
}
