import Dexie, { Table } from 'dexie';

export type TxType = 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'ADJUST';

export interface Book {
  id: string; name: string; cover: string; createdAt: number;
}
export interface Member {
  id: string; bookId: string; name: string; phone?: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'JOINED' | 'INVITED';
  remark?: string; isHidden: 0 | 1; sort: number;
}
export interface Category {
  id: string; bookId: string; parentId: string | null;
  name: string; icon: string; type: 'EXPENSE' | 'INCOME';
  sort: number; isHidden: 0 | 1;
}
export interface Account {
  id: string; bookId: string; name: string; icon: string;
  type: string; isLiability: 0 | 1; initBalance: number;
  includeInAssets: 0 | 1; remark?: string; isHidden: 0 | 1; sort: number;
}
export interface Project {
  id: string; bookId: string; name: string; icon: string; isHidden: 0 | 1; sort: number;
}
export interface Merchant {
  id: string; bookId: string; name: string; icon: string; isHidden: 0 | 1; sort: number;
}
export interface Tx {
  id: string; bookId: string; type: TxType;
  amount: number;                     // EXPENSE/INCOME/TRANSFER 恒为正; ADJUST 可为负
  categoryId?: string; accountId: string; toAccountId?: string;
  memberId?: string; projectId?: string; merchantId?: string;
  occurredAt: number; remark?: string; createdBy?: string;
  createdAt: number; updatedBy?: string; updatedAt?: number;
}

export class QingZhangDB extends Dexie {
  books!: Table<Book, string>;
  members!: Table<Member, string>;
  categories!: Table<Category, string>;
  accounts!: Table<Account, string>;
  projects!: Table<Project, string>;
  merchants!: Table<Merchant, string>;
  txs!: Table<Tx, string>;

  constructor() {
    super('qingzhang');
    this.version(1).stores({
      books: 'id',
      members: 'id, bookId',
      categories: 'id, bookId, parentId, type, [bookId+type]',
      accounts: 'id, bookId, isLiability',
      projects: 'id, bookId',
      merchants: 'id, bookId',
      txs: 'id, bookId, categoryId, accountId, toAccountId, memberId, projectId, merchantId, occurredAt, [bookId+occurredAt], [bookId+type]'
    });
  }
}

export const db = new QingZhangDB();

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const BOOK_ID = 'book_default';
