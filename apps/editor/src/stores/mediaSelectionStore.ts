import { create } from 'zustand';

interface MediaSelectionState {
  selectedMediaPath: string | null;
  setSelectedMediaPath: (path: string | null) => void;
}

export const useMediaSelectionStore = create<MediaSelectionState>((set) => ({
  selectedMediaPath: null,
  setSelectedMediaPath: (path) => set({ selectedMediaPath: path }),
}));
