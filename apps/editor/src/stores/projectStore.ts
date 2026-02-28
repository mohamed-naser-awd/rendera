import { create } from 'zustand';
import { getApiBaseUrl } from '../../../../shared/getApiUrl';

export interface TimelineNode {
  id: string;
  type: string;
  duration: number;
  label?: string;
}

export interface ProjectRoot {
  type: string;
  items?: TimelineNode[];
  [key: string]: unknown;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  root: ProjectRoot;
}

interface ProjectState {
  project: Project | null;
  loadProject: (id: string) => Promise<void>;
  createProject: () => Promise<void>;
  updateProject: (updates: {
    name?: string;
    description?: string;
    root?: ProjectRoot;
  }) => Promise<void>;
  addTimelineNode: (node: Omit<TimelineNode, 'id'>) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  loadProject: async (id: string) => {
    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/projects/${id}`);
    if (!res.ok) return;
    const project = await res.json();
    set({ project });
  },
  updateProject: async (updates: {
    name?: string;
    description?: string;
    root?: ProjectRoot;
  }) => {
    const { project } = get();
    if (!project) return;
    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return;
    set((s) =>
      s.project
        ? {
            project: {
              ...s.project,
              ...(updates.name !== undefined && { name: updates.name }),
              ...(updates.description !== undefined && { description: updates.description }),
              ...(updates.root !== undefined && { root: updates.root }),
            },
          }
        : s
    );
  },
  addTimelineNode: async (node: Omit<TimelineNode, 'id'>) => {
    const { project } = get();
    if (!project) return;
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const items = Array.isArray(project.root?.items) ? [...project.root.items] : [];
    items.push({ ...node, id });
    const root: ProjectRoot = { ...project.root, type: project.root?.type ?? 'stack', items };
    return get().updateProject({ root });
  },
  createProject: async () => {
    const baseUrl = await getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Untitled Project',
        description: '',
        resolution: '1920x1080',
        fps: 30,
        root: { type: 'stack', id: 'root', items: [], startTime: 0, duration: 0, trackIndex: 0 },
      }),
    });
    if (!res.ok) return;
    const { id } = await res.json();
    const projRes = await fetch(`${baseUrl}/api/projects/${id}`);
    const project = await projRes.json();
    set({ project });
  },
}));
