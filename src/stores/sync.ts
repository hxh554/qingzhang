import { create } from 'zustand';

interface SyncState {
  ready: boolean;
  online: boolean;
  pending: number;
  email: string | null;
  bookId: string | null;
  bookName: string | null;
  set: (p: Partial<Omit<SyncState, 'set'>>) => void;
}

export const useSync = create<SyncState>(set => ({
  ready: false,
  online: true,
  pending: 0,
  email: null,
  bookId: null,
  bookName: null,
  set: p => set(p),
}));
