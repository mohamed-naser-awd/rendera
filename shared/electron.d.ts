declare global {
  interface Window {
    electronAPI?: {
      getApiUrl: () => Promise<string>;
      openEditor: (projectId: string) => void;
      openRecorder: (projectId: string) => void;
      recorderDone: (projectId: string) => void;
    };
  }
}

export {};
