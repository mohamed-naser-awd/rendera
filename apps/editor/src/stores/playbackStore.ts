import { create } from 'zustand';

export type EmptyFill =
  | { type: 'color'; value: string }
  | { type: 'image'; url: string };

interface PlaybackState {
  /** Current video time (0 to content length). Used for preview playback and timeline playhead. */
  videoTime: number;
  playing: boolean;
  emptyFill: EmptyFill;
  /** Max timeline duration seen; timeline never shrinks below this. */
  maxTimelineDurationSeen: number;
  setVideoTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setEmptyFill: (fill: EmptyFill) => void;
  /** Update max duration if greater; call resetMaxTimelineDuration when project changes. */
  setMaxTimelineDurationIfGreater: (d: number) => void;
  resetMaxTimelineDuration: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  videoTime: 0,
  playing: false,
  emptyFill: { type: 'color', value: '#000000' },
  maxTimelineDurationSeen: 0,
  setVideoTime: (t) => set({ videoTime: Math.max(0, t) }),
  setPlaying: (p) => set({ playing: p }),
  setEmptyFill: (fill) => set({ emptyFill: fill }),
  setMaxTimelineDurationIfGreater: (d) =>
    set((s) => ({ maxTimelineDurationSeen: Math.max(s.maxTimelineDurationSeen, d) })),
  resetMaxTimelineDuration: () => set({ maxTimelineDurationSeen: 0 }),
}));
