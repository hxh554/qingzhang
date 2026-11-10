import { create } from 'zustand';
import type { Tx, TxType } from '../db/schema';

interface UiState {
  quickAddOpen: boolean;
  quickAddType: TxType;
  editing: Tx | null;
  privacy: boolean;
  openQuickAdd: (type?: TxType, editing?: Tx | null) => void;
  closeQuickAdd: () => void;
  togglePrivacy: () => void;
}

export const useUi = create<UiState>((set) => ({
  quickAddOpen: false,
  quickAddType: 'EXPENSE',
  editing: null,
  privacy: localStorage.getItem('qz_privacy') === '1',
  openQuickAdd: (type = 'EXPENSE', editing = null) => set({ quickAddOpen: true, quickAddType: type, editing }),
  closeQuickAdd: () => set({ quickAddOpen: false, editing: null }),
  togglePrivacy: () => set((s) => {
    localStorage.setItem('qz_privacy', s.privacy ? '0' : '1');
    return { privacy: !s.privacy };
  }),
}));
