import { db, BOOK_ID, uid } from '../db/schema';
import { supabase, cloudEnabled } from './cloud';
import { useSync } from '../stores/sync';

/** 与云端同步的数据表（books 单独处理，它没有 book_id） */
export const DATA_TABLES = ['members', 'categories', 'accounts', 'projects', 'merchants', 'txs'] as const;
export type DataTable = (typeof DATA_TABLES)[number];

const BOOK_KEY = 'qz_cloud_book';

/* ---------------- 字段名转换 ---------------- */
const toSnake = (o: Record<string, any>): Record<string, any> => {
  const r: Record<string, any> = {};
  for (const k of Object.keys(o)) {
    if (o[k] === undefined) continue;
    r[k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())] = o[k];
  }
  return r;
};
const toCamel = (o: Record<string, any>): Record<string, any> => {
  const r: Record<string, any> = {};
  for (const k of Object.keys(o)) {
    if (o[k] === undefined) continue;
    r[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = o[k];
  }
  return r;
};

/* ---------------- 状态 ---------------- */
/** PostgREST 可能把 numeric 返回成字符串，统一成数字，否则统计会出 NaN */
const NUM_KEYS = new Set(['amount', 'initBalance', 'occurredAt', 'createdAt', 'updatedAt', 'sort', 'isHidden', 'isLiability', 'includeInAssets']);
const norm = (rec: Record<string, any>) => {
  for (const k of Object.keys(rec)) {
    if (NUM_KEYS.has(k) && rec[k] !== null && rec[k] !== undefined) {
      const n = Number(rec[k]);
      if (Number.isFinite(n)) rec[k] = n;
    }
  }
  return rec;
};

let currentBook: string | null = null;
let suppress = 0;

export const cloudBook = () => currentBook;
export const storedBook = () => localStorage.getItem(BOOK_KEY);

const setStatus = (p: Partial<{ online: boolean; pending: number }>) => useSync.getState().set(p);

async function withRemote<T>(fn: () => Promise<T>): Promise<T> {
  suppress++;
  try {
    return await fn();
  } finally {
    suppress--;
  }
}

/* ---------------- 推送队列 ---------------- */
type Job = { table: string; kind: 'upsert' | 'delete'; row: Record<string, any> };

const queue: Job[] = [];
let flushing = false;

function enqueue(job: Job) {
  if (!cloudEnabled || suppress > 0 || !currentBook) return;
  // 本地账本 id 固定为 book_default，推云端时必须换成云端账本 id
  if (job.table === 'books') job.row.id = currentBook;
  else if (job.row.book_id !== undefined) job.row.book_id = currentBook;
  queue.push(job);
  setStatus({ pending: queue.length });
  void flush();
}

async function flush() {
  if (flushing || !supabase) return;
  flushing = true;
  try {
    while (queue.length) {
      const job = queue[0];
      const q = supabase.from(job.table);
      const { error } = job.kind === 'delete' ? await q.delete().eq('id', job.row.id) : await q.upsert(job.row);
      if (error) {
        setStatus({ online: false });
        console.warn('[sync] 推送失败，稍后重试：', error.message, job.table);
        await new Promise(r => setTimeout(r, 2000));
        break; // 保留队首，等下轮
      }
      queue.shift();
      setStatus({ online: true, pending: queue.length });
    }
  } finally {
    flushing = false;
    if (queue.length) setTimeout(() => void flush(), 4000);
  }
}

/* ---------------- Dexie 钩子：本机写入自动上云 ---------------- */
let hooked = false;
export function installHooks() {
  if (hooked || !cloudEnabled) return;
  hooked = true;
  const hookTable = (name: string) => {
    const t = (db as any)[name];
    t.hook('creating', (_pk: string, obj: any) => { enqueue({ table: name, kind: 'upsert', row: toSnake(obj) }); });
    t.hook('updating', (mods: any, pk: string, obj: any) => {
      enqueue({ table: name, kind: 'upsert', row: toSnake({ ...obj, ...mods, id: pk }) });
    });
    t.hook('deleting', (pk: string) => { enqueue({ table: name, kind: 'delete', row: { id: pk } }); });
  };
  DATA_TABLES.forEach(hookTable);
  hookTable('books');
}

/* ---------------- 拉取 ---------------- */
let lastSig = '';

export async function pullAll(bid: string, force = false) {
  if (!supabase) return;
  const { data: book } = await supabase.from('books').select('*').eq('id', bid).maybeSingle();
  const bags: Record<string, any[]> = {};
  for (const name of DATA_TABLES) {
    const { data, error } = await supabase.from(name).select('*').eq('book_id', bid);
    if (error) console.warn('[sync] 拉取失败', name, error.message);
    bags[name] = data ?? [];
  }
  // 内容没变就不动本地库，避免轮询导致页面反复重绘
  const sig = DATA_TABLES.map(n => (bags[n] ?? []).map(r => r.id).sort().join(',')).join('|');
  if (!force && sig === lastSig) return;
  lastSig = sig;

  await withRemote(async () => {
    await Promise.all(DATA_TABLES.map(n => (db as any)[n].clear()));
    await db.books.clear();
    if (book) {
      const b = norm(toCamel(book));
      await db.books.put({ ...b, id: BOOK_ID } as any);
    }
    for (const name of DATA_TABLES) {
      const rows = (bags[name] ?? []).map(r => norm({ ...toCamel(r), bookId: BOOK_ID }));
      if (rows.length) await (db as any)[name].bulkPut(rows);
    }
  });
}

/* ---------------- 首次上传本机账本 ---------------- */
/** includeTxs=false 时只传账本骨架（分类/账户/成员/项目/商家），用于首次登录快速就绪 */
export async function pushAll(bid: string, includeTxs = true) {
  if (!supabase) return;
  const book = await db.books.get(BOOK_ID);
  const rows: Array<{ table: string; data: any[] }> = [{ table: 'books', data: [] }];
  const bookRow = {
    id: bid,
    name: book?.name ?? '我的账本',
    cover: book?.cover ?? '📒',
    created_at: book?.createdAt ?? Date.now(),
  };
  rows[0].data = [bookRow];
  for (const name of DATA_TABLES) {
    if (!includeTxs && name === 'txs') continue;
    const list = await (db as any)[name].toArray();
    rows.push({ table: name, data: list.map((r: any) => ({ ...toSnake(r), book_id: bid })) });
  }
  for (const { table, data } of rows) {
    if (!data.length) continue;
    const { error } = await supabase.from(table).upsert(data);
    if (error) throw new Error(`${table} 上传失败：${error.message}`);
  }
}

/** CloudPanel 用：把本机流水补传到云端 */
export async function uploadLocalTxs() {
  if (!currentBook) throw new Error('未绑定账本');
  await pushAll(currentBook, true);
}

/* ---------------- 实时订阅 ---------------- */
let unsub: (() => void) | null = null;

export function subscribe(bid: string) {
  if (!supabase) return;
  unsub?.();
  const ch = supabase.channel('qz:' + bid);
  for (const name of DATA_TABLES) {
    ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: name, filter: `book_id=eq.${bid}` } as any,
      (p: any) => void applyChange(name, p));
  }
  ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: 'books', filter: `id=eq.${bid}` } as any,
    (p: any) => void applyChange('books', p));
  ch.subscribe();
  unsub = () => { if (supabase) void supabase.removeChannel(ch); };
}

async function applyChange(table: string, p: any) {
  if (suppress > 0) return;
  await withRemote(async () => {
    const t = (db as any)[table];
    if (p.eventType === 'DELETE') {
      if (p.old?.id) await t.delete(p.old.id);
      return;
    }
    const rec = norm(toCamel(p.new ?? {}));
    if (table === 'books') rec.id = BOOK_ID;
    else rec.bookId = BOOK_ID;
    await t.put(rec);
  });
}

/* ---------------- 轮询兜底 ----------------
   国内到 Supabase 的 WebSocket 经常连不上，realtime 不可靠；
   这里每 12 秒轻量比对一次，发现变化才落库，作为兜底。 */
let pollTimer: number | null = null;

export function startPolling(bid: string, ms = 12000) {
  stopPolling();
  const tick = async () => {
    if (document.visibilityState === 'hidden') return;
    if (suppress > 0 || queue.length > 0) return; // 本地还没推完，别覆盖
    try {
      await pullAll(bid);
    } catch (e) {
      console.warn('[sync] 轮询失败', e);
    }
  };
  pollTimer = window.setInterval(tick, ms);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void tick();
  });
}

export function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/* ---------------- 会话与账本绑定 ---------------- */
export async function bindBook(bid: string) {
  currentBook = bid;
  localStorage.setItem(BOOK_KEY, bid);
  useSync.getState().set({ bookId: bid });
  installHooks();
  subscribe(bid);
  startPolling(bid);
  const { data } = await supabase!.from('books').select('name').eq('id', bid).maybeSingle();
  if (data?.name) useSync.getState().set({ bookName: data.name });
}

/** 登录成功后调用：找到/创建云端账本，返回是否新建 */
export async function ensureBook(): Promise<{ bookId: string; created: boolean }> {
  if (!supabase) throw new Error('未配置云端');
  const { data: list, error } = await supabase.rpc('my_books');
  if (error) throw new Error('读取账本失败：' + error.message);
  if (list && list.length) {
    // 优先用本机记住的那本（刚加入别人账本时就是靠这条），否则取最近加入的那本
    const stored = storedBook();
    const hit = list.find((b: any) => b.book_id === stored);
    const bid = (hit ?? list[list.length - 1]).book_id as string;
    await pullAll(bid, true);          // 云端为准，登录即拉全量
    await bindBook(bid);
    return { bookId: bid, created: false };
  }
  // 还没有账本 → 先用本机账本新建一本，再把本机数据推上去
  const bid = uid();
  const local = await db.books.get(BOOK_ID);
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId) throw new Error('登录状态失效，请重新登录');

  // 顺序很重要：必须先建 book + 成员关系，业务表的 RLS 才允许写入
  const { error: e1 } = await supabase.from('books').insert({
    id: bid,
    name: local?.name ?? '我的账本',
    cover: local?.cover ?? '📒',
    created_at: local?.createdAt ?? Date.now(),
  });
  if (e1) throw new Error('创建账本失败：' + e1.message);

  const { error: e2 } = await supabase.from('book_members').insert({ book_id: bid, user_id: ownerId, role: 'owner' });
  if (e2) throw new Error('绑定账本失败：' + e2.message);

  await pushAll(bid, false);   // 只推账本骨架，不推演示流水（几百条会让登录卡住）
  await bindBook(bid);
  useSync.getState().set({ bookName: local?.name ?? '我的账本' });
  return { bookId: bid, created: true };
}

export async function joinByCode(code: string): Promise<string> {
  if (!supabase) throw new Error('未配置云端');
  const { data, error } = await supabase.rpc('join_book', { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ''));
  const bid = data as string;
  await pullAll(bid);
  await bindBook(bid);
  return bid;
}

export async function createInvite(): Promise<string> {
  if (!supabase || !currentBook) throw new Error('未绑定账本');
  const { data, error } = await supabase.rpc('create_invite', { p_book: currentBook });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function signOut() {
  if (!supabase) return;
  unsub?.();
  stopPolling();
  await supabase.auth.signOut();
  localStorage.removeItem(BOOK_KEY);
  currentBook = null;
  location.reload();
}

/** 云端清空（本地 clear() 不会触发 hook，所以必须显式删远端） */
export async function wipeCloud() {
  if (!supabase || !currentBook) return;
  queue.length = 0;
  for (const name of DATA_TABLES) {
    const { error } = await supabase.from(name).delete().eq('book_id', currentBook);
    if (error) console.warn('[sync] 清空失败', name, error.message);
  }
}
