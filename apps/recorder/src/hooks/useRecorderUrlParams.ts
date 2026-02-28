import { useEffect } from 'react';
import { useRecorderStore } from '../stores/recorderStore';

export function useRecorderUrlParams() {
  const { setProjectId } = useRecorderStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('projectId');
    setProjectId(id);
  }, [setProjectId]);

  useEffect(() => {
    const unsub = (
      window as {
        electronAPI?: { onSetProjectId?: (cb: (id: string) => void) => () => void };
      }
    ).electronAPI?.onSetProjectId?.(setProjectId);
    return () => unsub?.();
  }, [setProjectId]);
}
