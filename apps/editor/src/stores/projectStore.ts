import { create } from 'zustand';
import { getApiBaseUrl } from '@shared/getApiUrl';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useTimelineSelectionStore } from '@/stores/timelineSelectionStore';
import type { AppliedTransition } from '@/lib/transitions';

export interface CropRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type ObjectFit = 'contain' | 'cover' | 'fill' | 'none';

export interface TimelineNode {
  id: string;
  type: string;
  duration: number;
  startTime?: number;
  /** Track row index (0 = bottom/first track). Higher tracks render on top. */
  trackIndex?: number;
  label?: string;
  mediaPath?: string;
  crop?: CropRect;
  /** How media fills the frame: contain, cover, fill, none. Default contain. */
  objectFit?: ObjectFit;
  /** Scale of media (1 = 100%). Default 1. */
  scale?: number;
  /** When type is 'stack', children are the layered items. */
  children?: TimelineNode[];
  /** Text content for type 'text'. */
  text?: string;
  /** Background color for type 'text'. Hex or CSS color. */
  backgroundColor?: string;
  /** When true, text background is transparent (ignores backgroundColor). */
  backgroundColorTransparent?: boolean;
  /** Text color for type 'text'. Hex or CSS color. */
  textColor?: string;
  /** Font size for type 'text' in px. When undefined, text sizes to fit content. */
  fontSize?: number;
  /** Stack order within overlapping items (1 = bottom, higher = on top). Used when items on same track overlap in time. */
  stackIndex?: number;
  /** Transition applied when this clip ends into the next. Stored in project, passed to backend on save. */
  transitionOut?: AppliedTransition;
}

/** Optional default config for a media item; used when adding to timeline and in media panel. */
export interface MediaItemDefaults {
  duration?: number;
  crop?: CropRect | null;
  objectFit?: ObjectFit;
  scale?: number;
  /** For text media. */
  text?: string;
  backgroundColor?: string;
  backgroundColorTransparent?: boolean;
  textColor?: string;
  fontSize?: number;
}

export interface MediaItem {
  /** Stable identifier so media items can be duplicated even if they share the same path. */
  id: string;
  path: string;
  /** Defaults applied when adding this media to the timeline; also editable in media panel. */
  defaults?: MediaItemDefaults;
}

export interface Timeline {
  id: string;
  name: string;
  items: TimelineNode[];
  /** Minimum number of tracks to show (user can add empty tracks). */
  trackCount?: number;
}

export interface ProjectRoot {
  type: string;
  /** Multiple timelines (versions); only one active at a time. */
  timelines?: Timeline[];
  activeTimelineId?: string;
  items?: TimelineNode[];
  media?: MediaItem[];
  [key: string]: unknown;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  /** Project resolution string, e.g. "1920x1080". */
  resolution?: string;
  /** Frames per second for this project. */
  fps?: number;
  /** Optional cached duration in seconds (from backend metadata). */
  duration?: number;
  root: ProjectRoot;
}

interface PendingMedia {
  tempPath: string;
  file: File;
}

const MAX_UNDO_STEPS = 50;

/** When true, applyLocalUpdate does not push to undo stack (used during drag/resize). */
let recordingSuspended = false;

let tempSaveTimer: ReturnType<typeof setTimeout> | null = null;
const TEMP_SAVE_DEBOUNCE_MS = 800;

function schedulePutProjectTemp(projectId: string, root: ProjectRoot) {
  if (tempSaveTimer) clearTimeout(tempSaveTimer);
  tempSaveTimer = setTimeout(async () => {
    tempSaveTimer = null;
    try {
      const baseUrl = await getApiBaseUrl();
      await fetch(`${baseUrl}/api/projects/${projectId}/temp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root }),
      });
    } catch {
      /* ignore */
    }
  }, TEMP_SAVE_DEBOUNCE_MS);
}

interface ProjectState {
  project: Project | null;
  isDirty: boolean;
  pendingMedia: PendingMedia[];
  undoStack: ProjectRoot[];
  redoStack: ProjectRoot[];
  loadProject: (id: string) => Promise<void>;
  /** Discard temporary draft and reload project from server (cancel/revert). */
  discardProjectTemp: (id: string) => Promise<void>;
  createProject: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  /** Record current root for undo. Call once at drag/resize start, then suspend until end. */
  recordForUndo: () => void;
  setRecordingSuspended: (suspend: boolean) => void;
  updateProject: (updates: {
    name?: string;
    description?: string;
    resolution?: string;
    fps?: number;
    duration?: number;
    root?: ProjectRoot;
  }) => void;
  addTimeline: () => void;
  addTrack: () => void;
  removeTrack: (trackIndex: number) => void;
  setActiveTimeline: (id: string) => void;
  renameTimeline: (id: string, name: string) => void;
  addTimelineNode: (node: Omit<TimelineNode, 'id'>, options?: { startTime?: number; trackIndex?: number }) => void;
  updateTimelineNode: (nodeId: string, updates: {
    duration?: number;
    startTime?: number;
    trackIndex?: number;
    stackIndex?: number;
    crop?: CropRect | null;
    objectFit?: ObjectFit;
    scale?: number;
    text?: string;
    backgroundColor?: string;
    backgroundColorTransparent?: boolean;
    textColor?: string;
    fontSize?: number;
    transitionOut?: AppliedTransition;
  }) => void;
  /** Update a child node inside a stack (e.g. crop, objectFit, scale on the media layer). */
  updateStackChild: (stackNodeId: string, childId: string, updates: { crop?: CropRect | null; objectFit?: ObjectFit; scale?: number }) => void;
  moveTimelineNodeWithPush: (nodeId: string, newStartTime: number, newTrackIndex?: number) => void;
  moveTimelineGroupWithPush: (primaryNodeId: string, newStartTime: number, selectedIds: string[], newTrackIndex?: number) => void;
  removeTimelineNodes: (nodeIds: string[]) => void;
  insertTimelineNodes: (nodes: { node: Omit<TimelineNode, 'id'>; startOffset: number }[], baseTime: number) => void;
  addMedia: (file: File) => void;
  /** Add a media item that already exists on the server (e.g. from transform). */
  addMediaPath: (path: string) => void;
  addTextMedia: () => string | null;
  updateMediaItem: (path: string, updates: Partial<MediaItem>) => void;
  /** Remove a media item from the project media list by id. */
  removeMediaItem: (id: string) => void;
  saveProject: () => Promise<void>;
  getPendingFile: (tempPath: string) => File | undefined;
}

function ensureMediaIds(root: ProjectRoot): ProjectRoot {
  const media = Array.isArray(root.media) ? root.media : [];
  if (media.length === 0) return root;
  let changed = false;
  const withIds: MediaItem[] = media.map((m, index) => {
    const existing = m as MediaItem & { id?: string };
    if (existing.id && typeof existing.id === 'string') {
      return existing as MediaItem;
    }
    changed = true;
    return {
      ...existing,
      id: `media-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    } as MediaItem;
  });
  return changed ? { ...root, media: withIds } : root;
}

/** Ensure root has timelines and media ids; migrate legacy root.items to single timeline. */
function ensureTimelines(root: ProjectRoot): ProjectRoot {
  const timelines = root.timelines;
  if (Array.isArray(timelines) && timelines.length > 0) {
    const id = root.activeTimelineId ?? timelines[0].id;
    const hasActive = timelines.some((t) => t.id === id);
    return ensureMediaIds({
      ...root,
      activeTimelineId: hasActive ? id : timelines[0].id,
    });
  }
  const legacyItems = Array.isArray(root.items) ? root.items : [];
  const migrated: Timeline = {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Version 1',
    items: legacyItems,
  };
  return ensureMediaIds({
    ...root,
    timelines: [migrated],
    activeTimelineId: migrated.id,
    items: undefined,
  });
}

/** Get the currently active timeline from root. Use for reading active timeline items. */
export function getActiveTimeline(root: ProjectRoot): Timeline | null {
  const r = ensureTimelines(root);
  const id = r.activeTimelineId;
  const list = r.timelines ?? [];
  return list.find((t) => t.id === id) ?? list[0] ?? null;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  function recordForUndo() {
    if (recordingSuspended) return;
    const { project, undoStack } = get();
    if (!project) return;
    const snapshot = JSON.parse(JSON.stringify(project.root)) as ProjectRoot;
    const next = [...undoStack, snapshot].slice(-MAX_UNDO_STEPS);
    set({ undoStack: next, redoStack: [] });
  }

  function applyLocalUpdate(updates: {
    name?: string;
    description?: string;
    resolution?: string;
    fps?: number;
    duration?: number;
    root?: ProjectRoot;
  }) {
    const { project } = get();
    if (!project) return;
    if (updates.root !== undefined && !recordingSuspended) recordForUndo();
    set((s) =>
      s.project
        ? {
            project: {
              ...s.project,
              ...(updates.name !== undefined && { name: updates.name }),
              ...(updates.description !== undefined && { description: updates.description }),
              ...(updates.resolution !== undefined && { resolution: updates.resolution }),
              ...(updates.fps !== undefined && { fps: updates.fps }),
              ...(updates.duration !== undefined && { duration: updates.duration }),
              ...(updates.root !== undefined && { root: updates.root }),
            },
            isDirty: true,
          }
        : s
    );
    const next = get();
    if (next.project?.root) {
      schedulePutProjectTemp(next.project.id, next.project.root);
    }
  }

  return {
  project: null,
  isDirty: false,
  pendingMedia: [],
  undoStack: [],
  redoStack: [],
  undo: () => {
    const { project, undoStack, redoStack } = get();
    if (!project || undoStack.length === 0) return;
    const currentRoot = JSON.parse(JSON.stringify(project.root)) as ProjectRoot;
    const prevRoot = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, currentRoot],
      project: { ...project, root: prevRoot },
      isDirty: true,
    });
    usePlaybackStore.getState().resetMaxTimelineDuration();
    useTimelineSelectionStore.getState().clearSelection();
  },
  redo: () => {
    const { project, undoStack, redoStack } = get();
    if (!project || redoStack.length === 0) return;
    const currentRoot = JSON.parse(JSON.stringify(project.root)) as ProjectRoot;
    const nextRoot = redoStack[redoStack.length - 1];
    set({
      undoStack: [...undoStack, currentRoot],
      redoStack: redoStack.slice(0, -1),
      project: { ...project, root: nextRoot },
      isDirty: true,
    });
    usePlaybackStore.getState().resetMaxTimelineDuration();
    useTimelineSelectionStore.getState().clearSelection();
  },
  recordForUndo: () => {
    recordForUndo();
  },
  setRecordingSuspended: (suspend: boolean) => {
    recordingSuspended = suspend;
  },
  loadProject: async (id: string) => {
    const baseUrl = await getApiBaseUrl();
    const tempRes = await fetch(`${baseUrl}/api/projects/${id}/temp`);
    let project: Project;
    if (tempRes.ok) {
      const { root } = (await tempRes.json()) as { root: ProjectRoot };
      const fullRes = await fetch(`${baseUrl}/api/projects/${id}`);
      if (!fullRes.ok) return;
      project = await fullRes.json();
      project.root = ensureTimelines(root);
      project.name = project.name ?? 'Project';
    } else {
      const res = await fetch(`${baseUrl}/api/projects/${id}`);
      if (!res.ok) return;
      project = await res.json();
      if (project.root) {
        project.root = ensureTimelines(project.root);
      }
    }
    usePlaybackStore.getState().resetMaxTimelineDuration();
    set({ project, isDirty: !tempRes.ok, pendingMedia: [], undoStack: [], redoStack: [] });
  },
  discardProjectTemp: async (projectId: string) => {
    const baseUrl = await getApiBaseUrl();
    await fetch(`${baseUrl}/api/projects/${projectId}/temp`, { method: 'DELETE' });
    const getState = get();
    if (getState.project?.id === projectId) {
      const res = await fetch(`${baseUrl}/api/projects/${projectId}`);
      if (!res.ok) return;
      const project = await res.json();
      if (project.root) project.root = ensureTimelines(project.root);
      set({ project, isDirty: false, pendingMedia: [], undoStack: [], redoStack: [] });
      usePlaybackStore.getState().resetMaxTimelineDuration();
    }
  },
  updateProject: (updates: {
    name?: string;
    description?: string;
    resolution?: string;
    fps?: number;
    duration?: number;
    root?: ProjectRoot;
  }) => {
    applyLocalUpdate(updates);
  },
  addTimeline: () => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const timelines = [...(root.timelines ?? [])];
    const nextNum = timelines.length + 1;
    const timeline: Timeline = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: `Version ${nextNum}`,
      items: [],
    };
    timelines.push(timeline);
    const newRoot: ProjectRoot = { ...root, timelines, activeTimelineId: timeline.id };
    applyLocalUpdate({ root: newRoot });
    usePlaybackStore.getState().resetMaxTimelineDuration();
    useTimelineSelectionStore.getState().clearSelection();
  },
  addTrack: () => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const active = getActiveTimeline(root);
    if (!active) return;
    const items = active.items;
    const maxTrackFromItems = items.length > 0
      ? Math.max(...items.map((n) => (n.trackIndex ?? 0) + 1))
      : 0;
    const currentCount = Math.max(active.trackCount ?? 0, maxTrackFromItems, 1);
    const newTrackCount = currentCount + 1;
    const timelines = (root.timelines ?? []).map((t) =>
      t.id === active.id ? { ...t, trackCount: newTrackCount } : t
    );
    applyLocalUpdate({ root: { ...root, timelines } });
  },
  removeTrack: (trackIndex: number) => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const active = getActiveTimeline(root);
    if (!active) return;
    const currentCount = Math.max(active.trackCount ?? 0, active.items.length > 0 ? Math.max(...active.items.map((n) => (n.trackIndex ?? 0) + 1)) : 0, 1);
    if (currentCount <= 1) return;
    if (trackIndex < 0 || trackIndex >= currentCount) return;
    const items = active.items
      .filter((n) => (n.trackIndex ?? 0) !== trackIndex)
      .map((n) => {
        const ti = n.trackIndex ?? 0;
        if (ti > trackIndex) return { ...n, trackIndex: ti - 1 };
        return n;
      });
    const newTrackCount = Math.max(1, currentCount - 1);
    const timelines = (root.timelines ?? []).map((t) =>
      t.id === active.id ? { ...t, items, trackCount: newTrackCount } : t
    );
    applyLocalUpdate({ root: { ...root, timelines } });
    usePlaybackStore.getState().resetMaxTimelineDuration();
    const removedIds = active.items.filter((n) => (n.trackIndex ?? 0) === trackIndex).map((n) => n.id);
    const { selectedIds } = useTimelineSelectionStore.getState();
    if (removedIds.some((id) => selectedIds.includes(id))) {
      useTimelineSelectionStore.getState().clearSelection();
    }
  },
  setActiveTimeline: (id: string) => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const timelines = root.timelines ?? [];
    const target = timelines.find((t) => t.id === id);
    if (!target) return;
    const newRoot: ProjectRoot = { ...root, activeTimelineId: id };
    applyLocalUpdate({ root: newRoot });
    usePlaybackStore.getState().resetMaxTimelineDuration();
    useTimelineSelectionStore.getState().clearSelection();
    const maxEnd = target.items.length > 0
      ? Math.max(...target.items.map((n) => (n.startTime ?? 0) + n.duration))
      : 0;
    const { videoTime, setVideoTime } = usePlaybackStore.getState();
    if (videoTime > maxEnd) setVideoTime(maxEnd);
  },
  renameTimeline: (id: string, name: string) => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const timelines = (root.timelines ?? []).map((t) =>
      t.id === id ? { ...t, name: name.trim() || t.name } : t
    );
    if (timelines.some((t) => t.id === id)) {
      applyLocalUpdate({ root: { ...root, timelines } });
    }
  },
  addTimelineNode: (node: Omit<TimelineNode, 'id'>, options?: { startTime?: number; trackIndex?: number }) => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const active = getActiveTimeline(root);
    if (!active) return;
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const items = [...active.items];
    let startTime: number;
    let trackIndex: number;
    if (options?.startTime !== undefined) {
      startTime = Math.max(0, options.startTime);
      trackIndex = options.trackIndex ?? node.trackIndex ?? 0;
    } else {
      if (items.length > 0) {
        const ends = items.map((n) => (n.startTime ?? 0) + n.duration);
        startTime = Math.max(...ends);
      } else {
        startTime = 0;
      }
      trackIndex = node.trackIndex ?? 0;
    }
    items.push({ ...node, id, startTime, trackIndex });
    const minTracks = trackIndex + 1;
    const timelines = (root.timelines ?? []).map((t) => {
      if (t.id !== active.id) return t;
      const newTrackCount = Math.max(t.trackCount ?? 0, minTracks);
      return { ...t, items, ...(newTrackCount > 0 && { trackCount: newTrackCount }) };
    });
    const newRoot: ProjectRoot = { ...root, timelines };
    applyLocalUpdate({ root: newRoot });
  },
  updateTimelineNode: (nodeId: string, updates: {
    duration?: number;
    startTime?: number;
    trackIndex?: number;
    stackIndex?: number;
    crop?: CropRect | null;
    objectFit?: ObjectFit;
    scale?: number;
    text?: string;
    backgroundColor?: string;
    backgroundColorTransparent?: boolean;
    textColor?: string;
    fontSize?: number;
    transitionOut?: AppliedTransition;
  }) => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const active = getActiveTimeline(root);
    if (!active) return;
    const items = [...active.items];
    const idx = items.findIndex((n) => n.id === nodeId);
    if (idx < 0) return;
    const node = items[idx];
    const next = { ...node } as TimelineNode;
    if (updates.duration !== undefined) next.duration = updates.duration;
    if (updates.startTime !== undefined) next.startTime = Math.max(0, updates.startTime);
    if (updates.trackIndex !== undefined) next.trackIndex = Math.max(0, updates.trackIndex);
    if (updates.stackIndex !== undefined) next.stackIndex = Math.max(1, updates.stackIndex);
    if (updates.crop !== undefined) next.crop = updates.crop ?? undefined;
    if (updates.objectFit !== undefined) next.objectFit = updates.objectFit;
    if (updates.scale !== undefined) next.scale = Math.max(0.1, Math.min(3, updates.scale));
    if (updates.text !== undefined) next.text = updates.text;
    if (updates.backgroundColor !== undefined) next.backgroundColor = updates.backgroundColor;
    if (updates.backgroundColorTransparent !== undefined) next.backgroundColorTransparent = updates.backgroundColorTransparent;
    if (updates.textColor !== undefined) next.textColor = updates.textColor;
    if (updates.fontSize !== undefined) next.fontSize = updates.fontSize;
    if (updates.transitionOut !== undefined) next.transitionOut = updates.transitionOut;
    items[idx] = next;
    const timelines = (root.timelines ?? []).map((t) =>
      t.id === active.id ? { ...t, items } : t
    );
    applyLocalUpdate({ root: { ...root, timelines } });
  },
  updateStackChild: (stackNodeId: string, childId: string, updates: {
    crop?: CropRect | null;
    objectFit?: ObjectFit;
    scale?: number;
  }) => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const active = getActiveTimeline(root);
    if (!active) return;
    const items = [...active.items];
    const stackIdx = items.findIndex((n) => n.id === stackNodeId && n.type === 'stack' && Array.isArray(n.children));
    if (stackIdx < 0) return;
    const stack = items[stackIdx];
    const children = stack.children!.map((c) => {
      if (c.id !== childId) return c;
      const out = { ...c };
      if (updates.crop !== undefined) out.crop = updates.crop ?? undefined;
      if (updates.objectFit !== undefined) out.objectFit = updates.objectFit;
      if (updates.scale !== undefined) out.scale = Math.max(0.1, Math.min(3, updates.scale));
      return out;
    });
    items[stackIdx] = { ...stack, children };
    const timelines = (root.timelines ?? []).map((t) =>
      t.id === active.id ? { ...t, items } : t
    );
    applyLocalUpdate({ root: { ...root, timelines } });
  },
  moveTimelineNodeWithPush: (nodeId: string, newStartTime: number, newTrackIndex?: number) => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const active = getActiveTimeline(root);
    if (!active) return;
    const rawItems = [...active.items];
    const idx = rawItems.findIndex((n) => n.id === nodeId);
    if (idx < 0) return;
    const node = rawItems[idx];
    const duration = node.duration;
    const targetTrack = newTrackIndex ?? (node.trackIndex ?? 0);
    let myNewStart = Math.max(0, newStartTime);

    // Build items with explicit start times (same logic as TimelinePanel blocks)
    type ItemWithStart = TimelineNode & { start: number };
    const items: ItemWithStart[] = rawItems.map((n, i) => ({
      ...n,
      start: n.startTime ?? (i === 0 ? 0 : rawItems.slice(0, i).reduce((s, prev) => s + prev.duration, 0)),
    }));

    // Only consider items on the SAME track for overlap prevention
    const sameTrack = (n: ItemWithStart) => (n.trackIndex ?? 0) === targetTrack;
    const sorted = [...items].filter(sameTrack).sort((a, b) => a.start - b.start);
    const sortedDragIdx = sorted.findIndex((n) => n.id === nodeId);
    if (sortedDragIdx < 0) return;

    const newStarts = new Map<string, number>();
    newStarts.set(nodeId, myNewStart);

    let leftBoundary = myNewStart;
    const totalDurationLeft = sorted
      .slice(0, sortedDragIdx)
      .reduce((sum, n) => sum + n.duration, 0);
    let hadConstraint = false;

    // Push blocks to the LEFT (same track only): each must end at or before leftBoundary. Stop when a block hits 0.
    for (let i = sortedDragIdx - 1; i >= 0; i--) {
      const other = sorted[i];
      const otherStart = newStarts.get(other.id) ?? other.start;
      const otherEnd = otherStart + other.duration;
      if (otherEnd > leftBoundary) {
        const otherNewStart = Math.max(0, leftBoundary - other.duration);
        newStarts.set(other.id, otherNewStart);
        if (otherNewStart === 0) {
          // Block hit 0 - can't push further. Constrain dragging block and re-pack blocks to the left.
          myNewStart = Math.max(myNewStart, totalDurationLeft);
          newStarts.set(nodeId, myNewStart);
          hadConstraint = true;
          break;
        }
        leftBoundary = otherNewStart;
      }
    }

    // If we constrained, re-pack blocks to the left in [0, myNewStart] without overlap
    if (hadConstraint) {
      let packEnd = 0;
      for (let i = 0; i < sortedDragIdx; i++) {
        const other = sorted[i];
        newStarts.set(other.id, packEnd);
        packEnd += other.duration;
      }
    }

    let myFinalStart = newStarts.get(nodeId)!;
    let myFinalEnd = myFinalStart + duration;

    // Push blocks to the RIGHT (same track only): each must start at or after our end
    for (let i = sortedDragIdx + 1; i < sorted.length; i++) {
      const other = sorted[i];
      const otherStart = newStarts.get(other.id) ?? other.start;
      if (otherStart < myFinalEnd) {
        const otherNewStart = myFinalEnd;
        newStarts.set(other.id, otherNewStart);
        myFinalEnd = otherNewStart + other.duration;
      }
    }

    const updatedItems = rawItems.map((n) => {
      const updated = newStarts.get(n.id);
      if (updated !== undefined) {
        const next = { ...n, startTime: updated };
        if (newTrackIndex !== undefined) next.trackIndex = Math.max(0, newTrackIndex);
        return next;
      }
      return n;
    });

    const timelines = (root.timelines ?? []).map((t) =>
      t.id === active.id ? { ...t, items: updatedItems } : t
    );
    applyLocalUpdate({ root: { ...root, timelines } });
  },
  moveTimelineGroupWithPush: (primaryNodeId: string, newStartTime: number, selectedIds: string[], newTrackIndex?: number) => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const active = getActiveTimeline(root);
    if (!active) return;
    const rawItems = [...active.items];
    const selectedSet = new Set(selectedIds);
    if (!selectedSet.has(primaryNodeId) || selectedIds.length === 0) return;

    type ItemWithStart = TimelineNode & { start: number };
    const items: ItemWithStart[] = rawItems.map((n, i) => ({
      ...n,
      start: n.startTime ?? (i === 0 ? 0 : rawItems.slice(0, i).reduce((s, prev) => s + prev.duration, 0)),
    }));
    const primary = items.find((n) => n.id === primaryNodeId)!;
    const targetTrack = newTrackIndex ?? (primary.trackIndex ?? 0);

    // Only consider items on the SAME track for overlap prevention
    const sameTrack = (n: ItemWithStart) => (n.trackIndex ?? 0) === targetTrack;
    const sorted = [...items].filter(sameTrack).sort((a, b) => a.start - b.start);
    const groupIndices = sorted
      .map((n, i) => (selectedSet.has(n.id) ? i : -1))
      .filter((i) => i >= 0);

    if (groupIndices.length === 0) return;

    const groupStart = Math.min(...selectedIds.map((id) => (items.find((n) => n.id === id)?.start ?? 0)));
    const groupEnd = Math.max(...selectedIds.map((id) => {
      const n = items.find((x) => x.id === id)!;
      return n.start + n.duration;
    }));
    const groupDuration = groupEnd - groupStart;
    const delta = newStartTime - primary.start;
    let newGroupStart = Math.max(0, groupStart + delta);

    const newStarts = new Map<string, number>();
    for (const id of selectedIds) {
      const n = items.find((x) => x.id === id)!;
      const offset = n.start - groupStart;
      newStarts.set(id, newGroupStart + offset);
    }

    const firstGroupIdx = Math.min(...groupIndices);
    const lastGroupIdx = Math.max(...groupIndices);
    const totalDurationLeft = sorted
      .slice(0, firstGroupIdx)
      .reduce((sum, n) => sum + n.duration, 0);
    let leftBoundary = newGroupStart;
    let hadConstraint = false;

    for (let i = firstGroupIdx - 1; i >= 0; i--) {
      const other = sorted[i];
      const otherStart = newStarts.get(other.id) ?? other.start;
      const otherEnd = otherStart + other.duration;
      if (otherEnd > leftBoundary) {
        const otherNewStart = Math.max(0, leftBoundary - other.duration);
        newStarts.set(other.id, otherNewStart);
        if (otherNewStart === 0) {
          newGroupStart = Math.max(newGroupStart, totalDurationLeft);
          hadConstraint = true;
          break;
        }
        leftBoundary = otherNewStart;
      }
    }

    if (hadConstraint) {
      let packEnd = 0;
      for (let i = 0; i < firstGroupIdx; i++) {
        const other = sorted[i];
        newStarts.set(other.id, packEnd);
        packEnd += other.duration;
      }
      const reDelta = newGroupStart - groupStart;
      for (const id of selectedIds) {
        const n = items.find((x) => x.id === id)!;
        newStarts.set(id, n.start + reDelta);
      }
    }

    let groupEndAfterLeft = newGroupStart + groupDuration;
    for (let i = lastGroupIdx + 1; i < sorted.length; i++) {
      const other = sorted[i];
      const otherStart = newStarts.get(other.id) ?? other.start;
      if (otherStart < groupEndAfterLeft) {
        const otherNewStart = groupEndAfterLeft;
        newStarts.set(other.id, otherNewStart);
        groupEndAfterLeft = otherNewStart + other.duration;
      }
    }

    const updatedItems = rawItems.map((n) => {
      const updated = newStarts.get(n.id);
      let next = updated !== undefined ? { ...n, startTime: updated } : { ...n };
      if (newTrackIndex !== undefined && selectedSet.has(n.id)) {
        next = { ...next, trackIndex: Math.max(0, newTrackIndex) };
      }
      return next;
    });

    const timelines = (root.timelines ?? []).map((t) =>
      t.id === active.id ? { ...t, items: updatedItems } : t
    );
    applyLocalUpdate({ root: { ...root, timelines } });
  },
  removeTimelineNodes: (nodeIds: string[]) => {
    const { project } = get();
    if (!project) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const active = getActiveTimeline(root);
    if (!active) return;
    const idsToRemove = new Set(nodeIds);
    const items = active.items.filter((n) => !idsToRemove.has(n.id));
    const timelines = (root.timelines ?? []).map((t) =>
      t.id === active.id ? { ...t, items } : t
    );
    applyLocalUpdate({ root: { ...root, timelines } });
  },
  insertTimelineNodes: (nodes, baseTime) => {
    const { project } = get();
    if (!project || nodes.length === 0) return;
    const root = ensureTimelines(project.root ?? { type: 'stack' });
    const active = getActiveTimeline(root);
    if (!active) return;
    type ItemWithStart = TimelineNode & { start: number };
    const existing: ItemWithStart[] = active.items.map((n, i) => ({
      ...n,
      start: n.startTime ?? (i === 0 ? 0 : active.items.slice(0, i).reduce((s, prev) => s + prev.duration, 0)),
    }));
    const newItems: ItemWithStart[] = nodes.map(({ node, startOffset }, i) => ({
      ...node,
      id: `node-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
      startTime: baseTime + startOffset,
      start: baseTime + startOffset,
    }));
    const combined: ItemWithStart[] = [...existing, ...newItems].sort((a, b) => a.start - b.start);
    for (let i = 0; i < combined.length - 1; i++) {
      const curr = combined[i];
      const next = combined[i + 1];
      const currEnd = curr.start + curr.duration;
      if (next.start < currEnd) {
        next.start = currEnd;
        next.startTime = currEnd;
      }
    }
    const items: TimelineNode[] = combined.map(({ start, ...n }) => ({ ...n, startTime: start }));
    const timelines = (root.timelines ?? []).map((t) =>
      t.id === active.id ? { ...t, items } : t
    );
    applyLocalUpdate({ root: { ...root, timelines } });
    usePlaybackStore.getState().resetMaxTimelineDuration();
  },
  addMedia: (file: File) => {
    const { project } = get();
    if (!project) return;
    recordForUndo();
    const tempPath = `pending:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const media = Array.isArray(project.root?.media) ? [...project.root.media] : [];
    media.push({ id, path: tempPath });
    const root: ProjectRoot = { ...project.root, media };
    set((s) => ({
      project: s.project ? { ...s.project, root } : null,
      isDirty: true,
      pendingMedia: [...s.pendingMedia, { tempPath, file }],
    }));
  },
  addMediaPath: (path: string) => {
    const { project } = get();
    if (!project) return;
    const media = Array.isArray(project.root?.media) ? [...project.root.media] : [];
    if (media.some((m) => m.path === path)) return;
    const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    media.push({ id, path });
    set((s) =>
      s.project
        ? { project: { ...s.project, root: { ...s.project.root, media } }, isDirty: true }
        : s
    );
  },
  addTextMedia: () => {
    const { project } = get();
    if (!project) return null;
    recordForUndo();
    const textPath = `text:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const id = `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const media = Array.isArray(project.root?.media) ? [...project.root.media] : [];
    media.push({ id, path: textPath });
    applyLocalUpdate({ root: { ...project.root, media } });
    return textPath;
  },
  getPendingFile: (tempPath: string) => {
    return get().pendingMedia.find((p) => p.tempPath === tempPath)?.file;
  },
  updateMediaItem: (path: string, updates: Partial<MediaItem>) => {
    const { project } = get();
    if (!project) return;
    recordForUndo();
    const media = Array.isArray(project.root?.media) ? [...project.root.media] : [];
    const idx = media.findIndex((m) => m.path === path);
    if (idx < 0) return;
    const next = [...media];
    next[idx] = { ...next[idx], ...updates };
    applyLocalUpdate({ root: { ...project.root, media: next } });
  },
  removeMediaItem: (id: string) => {
    const { project } = get();
    if (!project) return;
    recordForUndo();
    const media = Array.isArray(project.root?.media) ? project.root.media.filter((m) => m.id !== id) : [];
    applyLocalUpdate({ root: { ...project.root, media } });
  },
  saveProject: async () => {
    const { project, pendingMedia: pending, loadProject } = get();
    if (!project || !get().isDirty) return;
    const baseUrl = await getApiBaseUrl();
    let root = ensureTimelines(project.root ?? { type: 'stack' });
    const media = Array.isArray(root?.media) ? [...root.media] : [];
    const pathMapping: Record<string, string> = {};
    for (const { tempPath, file } of pending) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${baseUrl}/api/projects/${project.id}/media`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) continue;
      const { path } = (await res.json()) as { path: string };
      pathMapping[tempPath] = path;
    }
    const finalMedia = media
      .map((m) => ({ ...m, path: pathMapping[m.path] ?? m.path }))
      .filter((m) => !m.path.startsWith('pending:'));
    const mapMediaPath = (n: TimelineNode) => ({
      ...n,
      mediaPath: n.mediaPath && pathMapping[n.mediaPath] ? pathMapping[n.mediaPath] : n.mediaPath,
    });
    const timelines = (root.timelines ?? []).map((t) => ({
      ...t,
      items: t.items.map(mapMediaPath),
    }));
    root = { ...root, media: finalMedia, timelines };
    const maxEnd = timelines.reduce((outerMax, tl) => {
      const localMax = tl.items.length > 0
        ? Math.max(...tl.items.map((n) => (n.startTime ?? 0) + n.duration))
        : 0;
      return Math.max(outerMax, localMax);
    }, 0);
    const duration = maxEnd > 0 ? maxEnd : null;
    const res = await fetch(`${baseUrl}/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: project.name,
        description: project.description,
        resolution: project.resolution,
        fps: project.fps,
        ...(duration !== null && { duration }),
        root,
      }),
    });
    if (!res.ok) return;
    set({ isDirty: false, pendingMedia: [] });
    await fetch(`${baseUrl}/api/projects/${project.id}/temp`, { method: 'DELETE' });
    await loadProject(project.id);
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
        root: (() => {
          const tlId = `tl-${Date.now()}`;
          return {
            type: 'stack',
            id: 'root',
            timelines: [{ id: tlId, name: 'Version 1', items: [] }],
            activeTimelineId: tlId,
            media: [],
            startTime: 0,
            duration: 0,
            trackIndex: 0,
          };
        })(),
      }),
    });
    if (!res.ok) return;
    const { id } = await res.json();
    const projRes = await fetch(`${baseUrl}/api/projects/${id}`);
    const project = await projRes.json();
    if (project.root) project.root = ensureTimelines(project.root);
    usePlaybackStore.getState().resetMaxTimelineDuration();
    set({ project, isDirty: false, pendingMedia: [], undoStack: [], redoStack: [] });
  },
};
});
