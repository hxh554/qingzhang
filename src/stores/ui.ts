import { create } from 'zustand';
import type { Tx, TxType } from '../db/schema';

interface UiState {
  quickAddOpen: boolean;
  quickAddType: TxType;
  editing: Tx | null;
  privacy: boolean;
  /** 手机端抽屉式导航是否展开（PC 端恒为不可见，不影响布局） */
  navOpen: boolean;
  openQuickAdd: (type?: TxType, editing?: Tx | null) => void;
  closeQuickAdd: () => void;
  togglePrivacy: () => void;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
}

export const useUi = create<UiState>((set) => ({
  quickAddOpen: false,
  quickAddType: 'EXPENSE',
  editing: null,
  privacy: localStorage.getItem('qz_privacy') === '1',
  navOpen: false,
  openQuickAdd: (type = 'EXPENSE', editing = null) => set({ quickAddOpen: true, quickAddType: type, editing, navOpen: false }),
  closeQuickAdd: () => set({ quickAddOpen: false, editing: null }),
  togglePrivacy: () => set((s) => {
    localStorage.setItem('qz_privacy', s.privacy ? '0' : '1');
    return { privacy: !s.privacy };
  }),
  openNav: () => set({ navOpen: true }),
  closeNav: () => set({ navOpen: false }),
  toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
}));
