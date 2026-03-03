import { create } from 'zustand';
import type { TimelineNode } from '@/stores/projectStore';

export interface ClipboardNode {
  /** Node data without id; startOffset is relative to the first copied node. */
  node: Omit<TimelineNode, 'id'>;
  startOffset: number;
}

interface ClipboardState {
  nodes: ClipboardNode[];
  setClipboard: (nodes: ClipboardNode[]) => void;
  clearClipboard: () => void;
  hasClipboard: () => boolean;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  nodes: [],
  setClipboard: (nodes) => set({ nodes }),
  clearClipboard: () => set({ nodes: [] }),
  hasClipboard: () => get().nodes.length > 0,
}));
