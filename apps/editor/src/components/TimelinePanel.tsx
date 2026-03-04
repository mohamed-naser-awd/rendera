import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { getActiveTimeline } from '@/stores/projectStore';
import type { TimelineNode } from '@/stores/projectStore';
import { useTimelineSelectionStore } from '@/stores/timelineSelectionStore';
import { useMediaSelectionStore } from '@/stores/mediaSelectionStore';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useClipboardActions } from '@/hooks/useClipboardActions';
import { useTimelineDuration } from '@/hooks/useTimelineDuration';
import { getDragNodeData, getDragMediaData, getDragTransitionData } from './NodePalette';
import CropDialog from './CropDialog';
import { RteTimeline } from './RteTimeline';
import { DEFAULT_TRANSITION_DURATION } from '@/lib/transitions';
import { getApiBaseUrl } from '@shared/getApiUrl';
import {
  transformNoiseCancellation,
  transformNanoBanana,
  transformExtractTranscript,
  transformVoiceOver,
  transformRecordVoice,
} from '@/lib/transformApi';

/** Zoom levels: duration per segment in seconds. */
const SEC = 1;
const MIN = 60;
const ZOOM_LEVELS_SEC: number[] = [
  1 * SEC, 5 * SEC, 10 * SEC, 15 * SEC, 30 * SEC,
  1 * MIN, 3 * MIN, 5 * MIN, 10 * MIN,
];
const DEFAULT_ZOOM_INDEX = 4;

function formatSegmentLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}m`;
}

type BlockWithStart = TimelineNode & { start: number };

/** Get items on the same track that overlap with this block in time. Includes the block itself. */
function getOverlapGroup(block: BlockWithStart, blocks: BlockWithStart[]): BlockWithStart[] {
  const track = block.trackIndex ?? 0;
  const start = block.start;
  const end = start + block.duration;
  return blocks.filter((b) => {
    if ((b.trackIndex ?? 0) !== track) return false;
    const bEnd = b.start + b.duration;
    return start < bEnd && b.start < end;
  });
}

type ContextMenu = { x: number; y: number; blockId: string } | null;
type TrackContextMenu = { x: number; y: number; trackIndex: number } | null;
type RowContextMenu = { x: number; y: number; trackIndex: number; time: number } | null;

export function TimelinePanel() {
  const { t } = useTranslation();
  const {
    project,
    addTimeline,
    addTrack,
    removeTrack,
    setActiveTimeline,
    renameTimeline,
    addTimelineNode,
    addMediaPath,
    updateTimelineNode,
    removeTimelineNodes,
    recordForUndo,
    setRecordingSuspended,
    getPendingFile,
  } = useProjectStore();
  const { selectedIds, setSelection, clearSelection, isSelected } = useTimelineSelectionStore();
  const { videoTime, setVideoTime } = usePlaybackStore();
  const { copy, cut, paste, canCopy, canPaste } = useClipboardActions();
  const [dragOver, setDragOver] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [cropDialogBlockId, setCropDialogBlockId] = useState<string | null>(null);
  const [editingTimelineId, setEditingTimelineId] = useState<string | null>(null);
  const [editingTimelineName, setEditingTimelineName] = useState('');
  const [dropTargetTrackIndex] = useState(0);
  const [trackContextMenu, setTrackContextMenu] = useState<TrackContextMenu>(null);
  const [rowContextMenu, setRowContextMenu] = useState<RowContextMenu>(null);
  const [zoomLevelIndex, setZoomLevelIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [transformBusy, setTransformBusy] = useState<string | null>(null);
  const [transformSubmenuOpen, setTransformSubmenuOpen] = useState(false);
  const transformSubmenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackScrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const recordVoiceInputRef = useRef<HTMLInputElement>(null);
  const pendingRecordBlockIdRef = useRef<string | null>(null);

  const root = project?.root;
  const activeTimeline = root ? getActiveTimeline(root) : null;
  const items: TimelineNode[] = activeTimeline?.items ?? [];
  const timelines = root?.timelines ?? [];
  const activeTimelineId = root?.activeTimelineId;
  const { maxEnd } = useTimelineDuration();
  const visibleDuration = ZOOM_LEVELS_SEC[zoomLevelIndex];

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const updateWidth = () => {
      setContainerWidth(Math.max(0, el.clientWidth - 48));
    };
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    updateWidth();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    function closeContextMenu() {
      setContextMenu(null);
      setTransformSubmenuOpen(false);
    }
    if (contextMenu) {
      window.addEventListener('click', closeContextMenu);
      window.addEventListener('contextmenu', closeContextMenu);
      return () => {
        window.removeEventListener('click', closeContextMenu);
        window.removeEventListener('contextmenu', closeContextMenu);
      };
    }
  }, [contextMenu]);

  useEffect(() => {
    function closeTrackContextMenu() {
      setTrackContextMenu(null);
    }
    if (trackContextMenu) {
      window.addEventListener('click', closeTrackContextMenu);
      window.addEventListener('contextmenu', closeTrackContextMenu);
      return () => {
        window.removeEventListener('click', closeTrackContextMenu);
        window.removeEventListener('contextmenu', closeTrackContextMenu);
      };
    }
  }, [trackContextMenu]);

  useEffect(() => {
    function closeRowContextMenu() {
      setRowContextMenu(null);
    }
    if (rowContextMenu) {
      window.addEventListener('click', closeRowContextMenu);
      window.addEventListener('contextmenu', closeRowContextMenu);
      return () => {
        window.removeEventListener('click', closeRowContextMenu);
        window.removeEventListener('contextmenu', closeRowContextMenu);
      };
    }
  }, [rowContextMenu]);

  const ROW_HEIGHT = 48;

  function getDropPosition(clientX: number, clientY: number): { trackIndex: number; time: number } | null {
    const wrapper = trackScrollRef.current;
    const editArea = wrapper?.querySelector('.timeline-editor-edit-area') as HTMLElement | null;
    const grid = editArea?.querySelector('.ReactVirtualized__Grid') as HTMLElement | null;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const scrollLeft = grid.scrollLeft ?? 0;
    const scrollTop = grid.scrollTop ?? 0;
    const scale = ZOOM_LEVELS_SEC[zoomLevelIndex] ?? 30;
    const scaleWidth = Math.max(20, (containerWidth - 48) / 5);
    const localX = clientX - rect.left + scrollLeft;
    const localY = clientY - rect.top + scrollTop;
    const trackIndex = Math.floor(localY / ROW_HEIGHT);
    if (trackIndex < 0) return null;
    const time = Math.max(0, (localX * scale) / scaleWidth);
    return { trackIndex: Math.max(0, trackIndex), time };
  }

  /** Find two adjacent clips on the same track such that the boundary between them is near the given time. */
  function findAdjacentClipsAtTime(
    blocks: BlockWithStart[],
    trackIndex: number,
    time: number,
    tolerance = 0.5
  ): { left: BlockWithStart; right: BlockWithStart } | null {
    const onTrack = blocks.filter((b) => (b.trackIndex ?? 0) === trackIndex).sort((a, b) => a.start - b.start);
    for (let i = 0; i < onTrack.length - 1; i++) {
      const left = onTrack[i];
      const right = onTrack[i + 1];
      const boundary = left.start + left.duration;
      if (Math.abs(boundary - time) <= tolerance) return { left, right };
    }
    return null;
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const trackIndex = dropTargetTrackIndex;
    const transitionData = getDragTransitionData(e.dataTransfer);
    if (transitionData) {
      const pos = getDropPosition(e.clientX, e.clientY);
      const blocks: BlockWithStart[] = items.map((node, idx) => {
        const start = node.startTime ?? (idx === 0 ? 0 : items.slice(0, idx).reduce((s, n) => s + n.duration, 0));
        return { ...node, start };
      });
      if (transitionData.requiresTwoVideos && pos) {
        const pair = findAdjacentClipsAtTime(blocks, pos.trackIndex, pos.time);
        if (pair) {
          recordForUndo?.();
          updateTimelineNode(pair.left.id, {
            transitionOut: { type: transitionData.transitionId as import('../lib/transitions').TransitionId, duration: DEFAULT_TRANSITION_DURATION },
          });
          return;
        }
      }
      if (!transitionData.requiresTwoVideos && selectedIds.length === 1) {
        const block = blocks.find((b) => b.id === selectedIds[0]);
        if (block) {
          recordForUndo?.();
          updateTimelineNode(block.id, {
            transitionOut: { type: transitionData.transitionId as import('../lib/transitions').TransitionId, duration: DEFAULT_TRANSITION_DURATION },
          });
          return;
        }
      }
      if (selectedIds.length === 2) {
        const [a, b] = selectedIds.map((id) => blocks.find((bl) => bl.id === id)!).filter(Boolean);
        if (a && b && (a.trackIndex ?? 0) === (b.trackIndex ?? 0)) {
          const [left, right] = a.start < b.start ? [a, b] : [b, a];
          if (Math.abs(left.start + left.duration - right.start) < 0.1) {
            recordForUndo?.();
            updateTimelineNode(left.id, {
              transitionOut: { type: transitionData.transitionId as import('../lib/transitions').TransitionId, duration: DEFAULT_TRANSITION_DURATION },
            });
            return;
          }
        }
      }
      return;
    }
    const mediaData = getDragMediaData(e.dataTransfer);
    if (mediaData) {
      const root = project?.root;
      const mediaList = Array.isArray(root?.media) ? root.media : [];
      const mediaItem = mediaList.find((m) => m.path === mediaData.path);
      const d = mediaItem?.defaults;
      const baseDuration = d?.duration ?? (mediaData.type === 'video' ? 10 : mediaData.type === 'text' ? 5 : 3);

      const placeNode = (finalDuration: number) => {
        const safeDuration = Math.max(0.1, finalDuration || baseDuration);
        addTimelineNode({
          type: mediaData.type,
          duration: safeDuration,
          label: mediaData.label,
          mediaPath: mediaData.path,
          crop: d?.crop ?? undefined,
          objectFit: d?.objectFit,
          scale: d?.scale,
          ...(mediaData.type === 'text' && {
            text: d?.text ?? mediaData.label,
            backgroundColor: d?.backgroundColor ?? '#ffffff',
            textColor: d?.textColor ?? '#000000',
            backgroundColorTransparent: d?.backgroundColorTransparent,
            fontSize: d?.fontSize,
          }),
          trackIndex,
        });
      };

      // For videos, try to use the actual media duration so the full clip is added.
      if (mediaData.type === 'video' && project) {
        const pendingFile = mediaData.path.startsWith('pending:')
          ? getPendingFile(mediaData.path)
          : undefined;

        if (pendingFile) {
          const url = URL.createObjectURL(pendingFile);
          const videoEl = document.createElement('video');
          videoEl.preload = 'metadata';
          videoEl.onloadedmetadata = () => {
            const duration = Number.isFinite(videoEl.duration) ? videoEl.duration : baseDuration;
            URL.revokeObjectURL(url);
            placeNode(duration);
          };
          videoEl.onerror = () => {
            URL.revokeObjectURL(url);
            placeNode(baseDuration);
          };
          videoEl.src = url;
        } else {
          const filename = mediaData.path.replace(/^media\//, '');
          getApiBaseUrl()
            .then((base) => {
              const url = `${base}/api/projects/${project.id}/media/${filename}`;
              const videoEl = document.createElement('video');
              videoEl.preload = 'metadata';
              videoEl.onloadedmetadata = () => {
                const duration = Number.isFinite(videoEl.duration) ? videoEl.duration : baseDuration;
                placeNode(duration);
              };
              videoEl.onerror = () => {
                placeNode(baseDuration);
              };
              videoEl.src = url;
            })
            .catch(() => {
              placeNode(baseDuration);
            });
        }
      } else {
        placeNode(baseDuration);
      }
      return;
    }
    const node = getDragNodeData(e.dataTransfer);
    if (node) addTimelineNode({ ...node, trackIndex });
  }

  const blocks = items.map((node, idx) => {
    const start = node.startTime ?? (idx === 0 ? 0 : items.slice(0, idx).reduce((s, n) => s + n.duration, 0));
    return { ...node, start };
  });
  /** Number of tracks: at least trackCount from timeline, or from items, or 1. */
  const maxTrackFromItems = blocks.length > 0
    ? Math.max(...blocks.map((b) => (b.trackIndex ?? 0) + 1))
    : 0;
  const trackCount = Math.max(activeTimeline?.trackCount ?? 0, maxTrackFromItems, 1);
  /** Track indices 0..N-1; render bottom-to-top (0 = bottom = layer 1, N-1 = top). */
  const trackIndices = Array.from({ length: trackCount }, (_, i) => i);
  const trackIndicesBottomToTop = [...trackIndices].reverse();

  function handleDeleteSelected() {
    removeTimelineNodes(selectedIds);
    clearSelection();
    setContextMenu(null);
  }

  async function runTransformFromNode(
    blockId: string,
    kind: 'noise' | 'nano' | 'transcript' | 'voiceover' | 'record',
    extra?: { text?: string; file?: File }
  ) {
    if (!project) return;
    const block = blocks.find((b) => b.id === blockId) as BlockWithStart | undefined;
    const startTime = block?.start ?? videoTime;
    const trackAbove = block ? Math.min((block.trackIndex ?? 0) + 1, trackCount) : 0;
    const source = { node_id: blockId };
    setContextMenu(null);
    setTransformBusy(kind);
    try {
      if (kind === 'noise') {
        const r = await transformNoiseCancellation(project.id, source);
        addMediaPath(r.path);
        addTimelineNode(
          { type: 'video', duration: 5, label: 'Noise cancelled', mediaPath: r.path },
          { startTime, trackIndex: trackAbove }
        );
      } else if (kind === 'nano') {
        const r = await transformNanoBanana(project.id, source, extra?.text ?? undefined);
        addMediaPath(r.path);
        addTimelineNode(
          { type: 'image', duration: 5, label: 'Nano Banana', mediaPath: r.path },
          { startTime, trackIndex: trackAbove }
        );
      } else if (kind === 'transcript') {
        const r = await transformExtractTranscript(project.id, source);
        addMediaPath(r.path);
      } else if (kind === 'voiceover' && extra?.text) {
        const r = await transformVoiceOver(project.id, extra.text, blockId);
        addMediaPath(r.path);
        addTimelineNode(
          { type: 'video', duration: 5, label: 'Voice over', mediaPath: r.path },
          { startTime, trackIndex: trackAbove }
        );
      } else if (kind === 'record' && extra?.file) {
        const r = await transformRecordVoice(project.id, extra.file, blockId, startTime);
        addMediaPath(r.path);
        addTimelineNode(
          { type: 'video', duration: 5, label: 'Recorded voice', mediaPath: r.path },
          { startTime: r.start_time ?? startTime, trackIndex: trackAbove }
        );
      }
    } finally {
      setTransformBusy(null);
    }
  }

  return (
    <>
    <section
      className="flex flex-col flex-shrink-0 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d] min-h-40 max-h-60 pb-0.5"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="h-8 flex-shrink-0 flex items-center gap-2 px-2 border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#252525]">
        {timelines.map((tl) => (
          editingTimelineId === tl.id ? (
            <input
              key={tl.id}
              type="text"
              value={editingTimelineName}
              onChange={(e) => setEditingTimelineName(e.target.value)}
              onBlur={() => {
                const trimmed = editingTimelineName.trim();
                if (trimmed) renameTimeline(tl.id, trimmed);
                setEditingTimelineId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = editingTimelineName.trim();
                  if (trimmed) renameTimeline(tl.id, trimmed);
                  setEditingTimelineId(null);
                }
                if (e.key === 'Escape') setEditingTimelineId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-6 min-w-[4rem] px-2 rounded text-sm bg-white dark:bg-[#383838] border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
            />
          ) : (
            <button
              key={tl.id}
              type="button"
              onClick={() => setActiveTimeline(tl.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingTimelineId(tl.id);
                setEditingTimelineName(tl.name);
              }}
              className={`h-6 flex items-center px-2.5 rounded text-sm font-medium transition-colors flex-shrink-0 ${
                tl.id === activeTimelineId
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                  : 'text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-[#383838]'
              }`}
              title={t('editor.timeline.doubleClickToRename', 'Double-click to rename')}
            >
              {tl.name}
            </button>
          )
        ))}
        <button
          type="button"
          onClick={() => addTimeline()}
          className="h-6 w-6 flex items-center justify-center flex-shrink-0 rounded text-slate-500 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-[#383838]"
          aria-label={t('editor.timeline.addTimeline', 'Add timeline')}
          title={t('editor.timeline.addTimeline', 'Add timeline')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            className="p-1.5 rounded text-slate-500 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-[#383838] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('editor.timeline.zoomOut', 'Zoom out')}
            title={t('editor.timeline.zoomOut', 'Zoom out')}
            disabled={zoomLevelIndex >= ZOOM_LEVELS_SEC.length - 1}
            onClick={() => setZoomLevelIndex((i) => Math.min(i + 1, ZOOM_LEVELS_SEC.length - 1))}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
          </button>
          <span
            className="text-xs text-slate-500 dark:text-white/50 tabular-nums min-w-[2rem] text-center select-none"
            aria-label={t('editor.timeline.segment', 'Segment')}
          >
            {formatSegmentLabel(visibleDuration)}
          </span>
          <button
            type="button"
            className="p-1.5 rounded text-slate-500 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-[#383838] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('editor.timeline.zoomIn', 'Zoom in')}
            title={t('editor.timeline.zoomIn', 'Zoom in')}
            disabled={zoomLevelIndex <= 0}
            onClick={() => setZoomLevelIndex((i) => Math.max(i - 1, 0))}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" /></svg>
          </button>
        </div>
      </div>
      <div
        ref={scrollAreaRef}
        className="timeline-scroll-area flex flex-1 min-h-0 overflow-auto border-b border-slate-200 dark:border-white/10"
      >
        <div className="flex flex-1 min-h-0 min-w-0">
        <div
          className="flex flex-col flex-shrink-0 w-12 border-r border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#252525]"
        >
          <div className="h-7 flex-shrink-0 flex items-center justify-center border-b border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={addTrack}
              className="flex items-center justify-center w-7 h-6 rounded text-slate-500 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-[#383838] hover:text-emerald-600 dark:hover:text-emerald-400"
              title={t('editor.timeline.addTrack', 'Add track')}
              aria-label={t('editor.timeline.addTrack', 'Add track')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          {trackIndicesBottomToTop.map((trackIdx) => (
            <div
              key={trackIdx}
              className="flex flex-1 min-h-0 items-center justify-center border-b border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-white/50 font-medium cursor-context-menu hover:bg-slate-200 dark:hover:bg-[#383838]"
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTrackContextMenu({ x: e.clientX, y: e.clientY, trackIndex: trackIdx });
              }}
            >
              {trackIdx + 1}
            </div>
          ))}
        </div>
        <div ref={trackScrollRef} className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col relative timeline-scroll-area basis-0">
          <RteTimeline
            items={items}
            trackCount={trackCount}
            videoTime={videoTime}
            onVideoTimeChange={setVideoTime}
            onItemsChange={(updates) => {
              for (const u of updates) {
                updateTimelineNode(u.id, { startTime: u.startTime, duration: u.duration, trackIndex: u.trackIndex });
              }
            }}
            selectedIds={selectedIds}
            onSelect={(actionId, addToSelection) => {
                useMediaSelectionStore.getState().setSelectedMediaPath(null);
                setSelection(actionId, addToSelection, blocks);
              }}
            onContextMenu={(actionId, e) => {
              if (!isSelected(actionId)) setSelection(actionId, false, blocks);
              setContextMenu({ x: e.clientX, y: e.clientY, blockId: actionId });
            }}
            onContextMenuRow={(trackIndex, time, e) => {
              setRowContextMenu({ x: e.clientX, y: e.clientY, trackIndex, time });
            }}
            zoomLevelIndex={zoomLevelIndex}
            recordForUndo={recordForUndo}
            setRecordingSuspended={setRecordingSuspended}
            maxEnd={maxEnd}
            containerWidth={Math.max(0, containerWidth - 48)}
          />
          {items.length === 0 && trackCount <= 1 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className={`text-sm ${dragOver ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-white/50'}`}>
                {t('editor.timeline.dropMedia', 'Drag and drop media here')}
              </p>
            </div>
          )}
        </div>
        </div>
      </div>
    </section>
    {contextMenu && (
      <div
        className="fixed z-50 min-w-[160px] py-1 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d]"
        style={{ left: contextMenu.x, bottom: window.innerHeight - contextMenu.y }}
      >
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => { cut(); setContextMenu(null); }}
          disabled={!canCopy}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
          </svg>
          {t('editor.timeline.cut', 'Cut')}
        </button>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => { copy(); setContextMenu(null); }}
          disabled={!canCopy}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {t('editor.timeline.copy', 'Copy')}
        </button>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => { paste(); setContextMenu(null); }}
          disabled={!canPaste}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {t('editor.timeline.paste', 'Paste')}
        </button>
        <div className="my-1 border-t border-slate-200 dark:border-white/10" />
        {(() => {
          const ctxBlock = blocks.find((b) => b.id === contextMenu.blockId) as BlockWithStart | undefined;
          const overlapGroup = ctxBlock ? getOverlapGroup(ctxBlock, blocks) : [];
          const canChangeStack = overlapGroup.length >= 2;
          const currentStack = ctxBlock?.stackIndex ?? 1;
          const maxInGroup = overlapGroup.length ? Math.max(...overlapGroup.map((b) => b.stackIndex ?? 1)) : 1;
          const minInGroup = overlapGroup.length ? Math.min(...overlapGroup.map((b) => b.stackIndex ?? 1)) : 1;
          const countAtMax = overlapGroup.filter((b) => (b.stackIndex ?? 1) === maxInGroup).length;
          const countAtMin = overlapGroup.filter((b) => (b.stackIndex ?? 1) === minInGroup).length;
          const isAtTop = currentStack === maxInGroup && countAtMax === 1;
          const isAtBottom = currentStack === minInGroup && countAtMin === 1;
          return (
            <>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canChangeStack || isAtTop}
                onClick={() => {
                  if (canChangeStack && !isAtTop) {
                    recordForUndo?.();
                    updateTimelineNode(contextMenu.blockId, { stackIndex: maxInGroup + 1 });
                  }
                  setContextMenu(null);
                }}
                title={!canChangeStack ? t('editor.timeline.bringToTopDisabled', 'No overlapping items on same track') : undefined}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                {t('editor.timeline.bringToTop', 'Bring to top')}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canChangeStack || isAtBottom}
                onClick={() => {
                  if (canChangeStack && !isAtBottom) {
                    recordForUndo?.();
                    updateTimelineNode(contextMenu.blockId, { stackIndex: 1 });
                  }
                  setContextMenu(null);
                }}
                title={!canChangeStack ? t('editor.timeline.moveToBottomDisabled', 'No overlapping items on same track') : undefined}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {t('editor.timeline.moveToBottom', 'Move to bottom')}
              </button>
              <div className="my-1 border-t border-slate-200 dark:border-white/10" />
            </>
          );
        })()}
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
          onClick={() => {
            setCropDialogBlockId(contextMenu.blockId);
            setContextMenu(null);
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {t('editor.timeline.crop', 'Crop')}
        </button>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
          onClick={handleDeleteSelected}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4m1 4h.01M12 4h.01M17 4v.01M7 4v.01" />
          </svg>
          {t('editor.timeline.delete', 'Delete')}
        </button>
        <div className="my-1 border-t border-slate-200 dark:border-white/10" />
        <div
          className="relative"
          onMouseEnter={() => {
            if (transformSubmenuTimerRef.current) {
              clearTimeout(transformSubmenuTimerRef.current);
              transformSubmenuTimerRef.current = null;
            }
            setTransformSubmenuOpen(true);
          }}
          onMouseLeave={() => {
            transformSubmenuTimerRef.current = setTimeout(() => setTransformSubmenuOpen(false), 150);
          }}
        >
          <div className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center justify-between gap-2 cursor-default">
            <span>{t('editor.tabs.transform', 'Transform')}</span>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          {transformSubmenuOpen && (
            <div
              className="absolute left-full top-0 ml-0.5 min-w-[180px] py-1 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d] z-[60]"
              onMouseEnter={() => {
                if (transformSubmenuTimerRef.current) {
                  clearTimeout(transformSubmenuTimerRef.current);
                  transformSubmenuTimerRef.current = null;
                }
              }}
              onMouseLeave={() => {
                transformSubmenuTimerRef.current = setTimeout(() => setTransformSubmenuOpen(false), 150);
              }}
            >
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50"
                disabled={!!transformBusy}
                onClick={() => runTransformFromNode(contextMenu.blockId, 'noise')}
              >
                {t('editor.transform.noiseCancellation', 'Noise Cancellation')}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50"
                disabled={!!transformBusy}
                onClick={() => {
                  const text = window.prompt(t('editor.transform.promptPlaceholder', 'Describe edit or leave empty'));
                  runTransformFromNode(contextMenu.blockId, 'nano', { text: text ?? undefined });
                }}
              >
                {t('editor.transform.nanoBanana', 'Nano Banana')}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50"
                disabled={!!transformBusy}
                onClick={() => runTransformFromNode(contextMenu.blockId, 'transcript')}
              >
                {t('editor.transform.extractTranscript', 'Extract Transcript')}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50"
                disabled={!!transformBusy}
                onClick={() => {
                  const text = window.prompt(t('editor.transform.voiceOverPlaceholder', 'Type text to generate speech'));
                  if (text?.trim()) runTransformFromNode(contextMenu.blockId, 'voiceover', { text: text.trim() });
                }}
              >
                {t('editor.transform.voiceOver', 'Voice Over')}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50"
                disabled={!!transformBusy}
                onClick={() => {
                  pendingRecordBlockIdRef.current = contextMenu.blockId;
                  setContextMenu(null);
                  recordVoiceInputRef.current?.click();
                }}
              >
                {t('editor.transform.recordVoice', 'Record Voice')}
              </button>
            </div>
          )}
        </div>
        <div className="my-1 border-t border-slate-200 dark:border-white/10" />
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
          onClick={() => { clearSelection(); setContextMenu(null); }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {t('editor.timeline.clearSelection', 'Clear selection')}
        </button>
      </div>
    )}
    <input
      ref={recordVoiceInputRef}
      type="file"
      accept="audio/*,video/webm"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        const blockId = pendingRecordBlockIdRef.current;
        if (file && blockId && project) {
          pendingRecordBlockIdRef.current = null;
          runTransformFromNode(blockId, 'record', { file });
        }
        e.target.value = '';
      }}
    />
    {trackContextMenu !== null && (
      <div
        className="fixed z-50 min-w-[160px] py-1 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d]"
        style={{ left: trackContextMenu.x, bottom: window.innerHeight - trackContextMenu.y }}
      >
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          disabled={trackCount <= 1}
          onClick={() => {
            if (trackCount <= 1) return;
            const trackLabel = trackContextMenu.trackIndex + 1;
            const confirmed = window.confirm(
              t('editor.timeline.deleteTrackConfirm', `Delete track ${trackLabel}? All clips on this track will be removed.`)
            );
            if (confirmed) {
              removeTrack(trackContextMenu.trackIndex);
            }
            setTrackContextMenu(null);
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4m1 4h.01M12 4h.01M17 4v.01M7 4v.01" />
          </svg>
          {t('editor.timeline.deleteTrack', 'Delete track')}
        </button>
      </div>
    )}
    {rowContextMenu !== null && (
      <div
        className="fixed z-50 min-w-[160px] py-1 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d]"
        style={{ left: rowContextMenu.x, bottom: window.innerHeight - rowContextMenu.y }}
      >
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!canPaste}
          onClick={() => {
            paste();
            setVideoTime(rowContextMenu.time);
            setRowContextMenu(null);
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {t('editor.timeline.paste', 'Paste')}
        </button>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
          onClick={() => {
            setVideoTime(rowContextMenu.time);
            setRowContextMenu(null);
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('editor.timeline.seekToTime', 'Seek playhead here')}
        </button>
      </div>
    )}
    {cropDialogBlockId && (() => {
      const block = blocks.find((b) => b.id === cropDialogBlockId);
      if (!block) return null;
      return (
        <CropDialog
          block={block}
          onSave={(crop) => {
            const isDefault = crop.top === 0 && crop.right === 0 && crop.bottom === 0 && crop.left === 0;
            updateTimelineNode(cropDialogBlockId, { crop: isDefault ? null : crop });
          }}
          onClose={() => setCropDialogBlockId(null)}
        />
      );
    })()}
    </>
  );
}
