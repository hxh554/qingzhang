import { useEffect, useRef, useState } from 'react';
import { IconLeft, IconRight } from './icons';

/** 年月选择器：‹ 2026年11月 ▾ ›，点中间展开年月面板 */
export function MonthPicker({ y, m, onChange }: { y: number; m: number; onChange: (y: number, m: number) => void }) {
  const [open, setOpen] = useState(false);
  const [vy, setVy] = useState(y);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setVy(y); }, [open, y]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const shift = (d: number) => {
    const nd = new Date(y, m + d, 1);
    onChange(nd.getFullYear(), nd.getMonth());
  };

  const go = (yy: number, mm: number) => {
    onChange(yy, mm);
    setOpen(false);
  };

  const today = new Date();
  const thisMonth = today.getFullYear() === y && today.getMonth() === m;

  return (
    <div className="month-nav" ref={boxRef}>
      <button onClick={() => shift(-1)} aria-label="上个月"><IconLeft /></button>
      <button className="cur" onClick={() => setOpen(o => !o)} title="选择年月">
        {y}年{m + 1}月
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </button>
      <button onClick={() => shift(1)} aria-label="下个月"><IconRight /></button>

      {open && (
        <div className="month-panel">
          <div className="yp-nav">
            <button onClick={() => setVy(v => v - 1)} aria-label="上一年"><IconLeft /></button>
            <span>{vy}年</span>
            <button onClick={() => setVy(v => v + 1)} aria-label="下一年"><IconRight /></button>
          </div>
          <div className="month-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <button key={i} className={vy === y && i === m ? 'on' : ''} onClick={() => go(vy, i)}>
                {i + 1}月
              </button>
            ))}
          </div>
          <div className="quick">
            <button onClick={() => go(today.getFullYear(), today.getMonth())}>回到本月</button>
            {!thisMonth && <button onClick={() => go(y, m)}>取消</button>}
          </div>
        </div>
      )}
    </div>
  );
}
