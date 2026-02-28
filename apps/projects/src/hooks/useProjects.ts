import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../../../../shared/getApiUrl';
import type { Project } from '../types';
import { DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_DESCRIPTION } from '../constants';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function fetchProjects() {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = await getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/projects`);
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  async function createProject(
    name: string = DEFAULT_PROJECT_NAME,
    description: string = DEFAULT_PROJECT_DESCRIPTION
  ) {
    if (creating || !window.electronAPI?.openEditor) return;
    setCreating(true);
    try {
      const baseUrl = await getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || DEFAULT_PROJECT_NAME,
          description: description.trim() || undefined,
          resolution: '1920x1080',
          fps: 30,
          root: { type: 'stack', items: [] },
        }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const { id } = await res.json();
      await fetchProjects();
      window.electronAPI.openEditor(id);
    } catch {
      setError('Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function createAndRecord(
    name: string = DEFAULT_PROJECT_NAME,
    description: string = DEFAULT_PROJECT_DESCRIPTION
  ) {
    if (creating || !window.electronAPI?.openRecorder) return;
    setCreating(true);
    try {
      const baseUrl = await getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || DEFAULT_PROJECT_NAME,
          description: description.trim() || undefined,
          resolution: '1920x1080',
          fps: 30,
          root: { type: 'stack', items: [] },
        }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const { id } = await res.json();
      await fetchProjects();
      window.electronAPI.openRecorder(id);
    } catch {
      setError('Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(id: string) {
    try {
      const baseUrl = await getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setProjects((p) => p.filter((x) => x.id !== id));
    } catch {
      setError('Failed to delete project');
    }
  }

  function openProject(id: string) {
    window.electronAPI?.openEditor?.(id);
  }

  function recordProject(id: string) {
    window.electronAPI?.openRecorder?.(id);
  }

  const hasElectron =
    typeof window !== 'undefined' &&
    !!(window.electronAPI?.openEditor ?? window.electronAPI?.openRecorder);

  return {
    projects,
    loading,
    error,
    creating,
    hasElectron,
    fetchProjects,
    createProject,
    createAndRecord,
    deleteProject,
    openProject,
    recordProject,
  };
}
