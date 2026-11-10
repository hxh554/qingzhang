import { db } from '../db/schema';
import type { Book, Member, Category, Account, Project, Merchant, Tx } from '../db/schema';

/** 账本快照：把本地库整包打走，用于「分享链接 / 分享码」 */
export interface Snap {
  v: 1;
  at: number;
  name: string;
  book: Book;
  members: Member[];
  categories: Category[];
  accounts: Account[];
  projects: Project[];
  merchants: Merchant[];
  txs: Tx[];
}

export async function buildSnap(): Promise<Snap> {
  const [book] = await db.books.toArray();
  const [members, categories, accounts, projects, merchants, txs] = await Promise.all([
    db.members.toArray(),
    db.categories.toArray(),
    db.accounts.toArray(),
    db.projects.toArray(),
    db.merchants.toArray(),
    db.txs.toArray(),
  ]);
  return {
    v: 1, at: Date.now(), name: book?.name ?? '我的账本',
    book: book ?? { id: 'book_default', name: '我的账本', cover: '📒', createdAt: Date.now() },
    members, categories, accounts, projects, merchants, txs,
  };
}

/* ---------- base64url ---------- */
function toB64(bytes: Uint8Array): string {
  let s = '';
  const CH = 8192;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as unknown as number[]);
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64(str: string): Uint8Array {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* ---------- deflate-raw ---------- */
async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  const CS = (globalThis as any).CompressionStream;
  if (!CS) return null;
  try {
    const stream = new Blob([bytes as any]).stream().pipeThrough(new CS('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as any).DecompressionStream;
  if (!DS) throw new Error('当前浏览器不支持解压缩，请用 Chrome / Edge 等新版浏览器打开');
  try {
    const stream = new Blob([bytes as any]).stream().pipeThrough(new DS('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error('分享码已损坏，请让对方重新生成');
  }
}

/** 编码：首字符 z = 已压缩，r = 未压缩原文 */
export async function encodeSnap(snap: Snap): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(snap));
  const packed = await deflateRaw(bytes);
  return packed ? 'z' + toB64(packed) : 'r' + toB64(bytes);
}

export async function decodeSnap(code: string): Promise<Snap> {
  const raw = (code || '').trim().replace(/\s+/g, '');
  if (!raw) throw new Error('分享码为空');
  const tag = raw[0];
  const body = fromB64(raw.slice(1));
  const bytes = tag === 'z' ? await inflateRaw(body) : body;
  let data: Snap;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('分享码已损坏，请让对方重新生成');
  }
  if (!data || data.v !== 1 || !Array.isArray(data.txs)) throw new Error('分享码格式不正确');
  return data;
}

/** 覆盖式导入：本地全部清空后写入快照（种子数据会被替换） */
export async function importSnap(snap: Snap): Promise<void> {
  await db.transaction(
    'rw',
    [db.books, db.members, db.categories, db.accounts, db.projects, db.merchants, db.txs],
    async () => {
      await Promise.all([
        db.txs.clear(), db.members.clear(), db.categories.clear(),
        db.accounts.clear(), db.projects.clear(), db.merchants.clear(), db.books.clear(),
      ]);
      await db.books.put(snap.book);
      if (snap.members?.length) await db.members.bulkPut(snap.members);
      if (snap.categories?.length) await db.categories.bulkPut(snap.categories);
      if (snap.accounts?.length) await db.accounts.bulkPut(snap.accounts);
      if (snap.projects?.length) await db.projects.bulkPut(snap.projects);
      if (snap.merchants?.length) await db.merchants.bulkPut(snap.merchants);
      if (snap.txs?.length) await db.txs.bulkPut(snap.txs);
    }
  );
}

/** 生成可分享链接（hash 路由，静态托管也能用） */
export function joinLink(code: string): string {
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  return `${base}#/join/${code}`;
}

export function snapSummary(snap: Snap) {
  const times = snap.txs.map(t => t.occurredAt);
  const min = times.length ? Math.min(...times) : 0;
  const max = times.length ? Math.max(...times) : 0;
  const day = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return {
    name: snap.name,
    txCount: snap.txs.length,
    memberCount: snap.members?.length ?? 0,
    range: times.length ? `${day(min)} ~ ${day(max)}` : '—',
    at: snap.at,
  };
}
