/// <reference path="../../../../shared/electron.d.ts" />
import { create } from 'zustand';

interface RecorderState {
  isRecording: boolean;
  cameraOn: boolean;
  micMuted: boolean;
  pcSoundOn: boolean;
  micMode: 'on' | 'muted' | 'pushToTalk';
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  startRecording: () => void;
  stopRecording: () => void;
  toggleCamera: () => void;
  toggleMic: () => void;
  togglePcSound: () => void;
}

export const useRecorderStore = create<RecorderState>((set, get) => ({
  isRecording: false,
  cameraOn: false,
  micMuted: false,
  pcSoundOn: true,
  micMode: 'on',
  projectId: null,
  setProjectId: (id) => set({ projectId: id }),
  startRecording: () => set({ isRecording: true }),
  stopRecording: () => {
    const { projectId } = get();
    set({ isRecording: false });
    if (projectId && window.electronAPI?.recorderDone) {
      window.electronAPI.recorderDone(projectId);
    }
  },
  toggleCamera: () => set((s) => ({ cameraOn: !s.cameraOn })),
  toggleMic: () => set((s) => ({ micMuted: !s.micMuted })),
  togglePcSound: () => set((s) => ({ pcSoundOn: !s.pcSoundOn })),
}));
