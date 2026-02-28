import { useEffect } from 'react';
import { useProjectStore } from '../stores/projectStore';

export function useInitialProjectId() {
  const { loadProject } = useProjectStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('projectId');
    if (id) loadProject(id);
  }, [loadProject]);

  useEffect(() => {
    const unsub = (
      window as {
        electronAPI?: { onOpenProject?: (cb: (id: string) => void) => () => void };
      }
    ).electronAPI?.onOpenProject?.(loadProject);
    return () => unsub?.();
  }, [loadProject]);
}
