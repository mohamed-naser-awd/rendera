import { create } from 'zustand';

interface TimelineSelectionState {
  selectedIds: string[];
  anchorId: string | null;
  setSelection: (nodeId: string, shiftKey: boolean, sortedIds: string[]) => void;
  clearSelection: () => void;
  isSelected: (nodeId: string) => boolean;
}

export const useTimelineSelectionStore = create<TimelineSelectionState>((set, get) => ({
  selectedIds: [],
  anchorId: null,
  setSelection: (nodeId: string, shiftKey: boolean, sortedIds: string[]) => {
    const { anchorId } = get();
    if (shiftKey && anchorId) {
      const anchorIdx = sortedIds.indexOf(anchorId);
      const clickIdx = sortedIds.indexOf(nodeId);
      if (anchorIdx >= 0 && clickIdx >= 0) {
        const [lo, hi] = anchorIdx <= clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx];
        set({ selectedIds: sortedIds.slice(lo, hi + 1) });
        return;
      }
    }
    set({ selectedIds: [nodeId], anchorId: nodeId });
  },
  clearSelection: () => set({ selectedIds: [], anchorId: null }),
  isSelected: (nodeId: string) => get().selectedIds.includes(nodeId),
}));
