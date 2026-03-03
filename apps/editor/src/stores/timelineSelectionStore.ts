import { create } from 'zustand';

export interface BlockForSelection {
  id: string;
  trackIndex?: number;
  start: number;
}

interface TimelineSelectionState {
  selectedIds: string[];
  anchorId: string | null;
  setSelection: (nodeId: string, shiftKey: boolean, blocks: BlockForSelection[]) => void;
  clearSelection: () => void;
  isSelected: (nodeId: string) => boolean;
}

export const useTimelineSelectionStore = create<TimelineSelectionState>((set, get) => ({
  selectedIds: [],
  anchorId: null,
  setSelection: (nodeId: string, shiftKey: boolean, blocks: BlockForSelection[]) => {
    const { anchorId } = get();
    if (shiftKey && anchorId) {
      const anchorBlock = blocks.find((b) => b.id === anchorId);
      const clickBlock = blocks.find((b) => b.id === nodeId);
      const anchorTrack = anchorBlock?.trackIndex ?? 0;
      const clickTrack = clickBlock?.trackIndex ?? 0;
      if (anchorBlock && clickBlock && anchorTrack === clickTrack) {
        const sameTrack = blocks
          .filter((b) => (b.trackIndex ?? 0) === anchorTrack)
          .sort((a, b) => a.start - b.start);
        const anchorIdx = sameTrack.findIndex((b) => b.id === anchorId);
        const clickIdx = sameTrack.findIndex((b) => b.id === nodeId);
        if (anchorIdx >= 0 && clickIdx >= 0) {
          const [lo, hi] = anchorIdx <= clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx];
          set({ selectedIds: sameTrack.slice(lo, hi + 1).map((b) => b.id) });
          return;
        }
      }
    }
    set({ selectedIds: [nodeId], anchorId: nodeId });
  },
  clearSelection: () => set({ selectedIds: [], anchorId: null }),
  isSelected: (nodeId: string) => get().selectedIds.includes(nodeId),
}));
