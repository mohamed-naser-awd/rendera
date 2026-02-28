import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../stores/projectStore';
import { getActiveTimeline } from '../stores/projectStore';
import type { TimelineNode } from '../stores/projectStore';
import { useTimelineSelectionStore } from '../stores/timelineSelectionStore';
import { usePlaybackStore } from '../stores/playbackStore';
import { useClipboardActions } from '../hooks/useClipboardActions';
import { useTimelineDuration } from '../hooks/useTimelineDuration';
import { getDragNodeData, getDragMediaData } from './NodePalette';
import CropDialog from './CropDialog';
const MIN_BLOCK_WIDTH_PX = 64;
const MIN_BLOCK_DURATION_SEC = 0.5;
/** Duration used when timeline is empty and user drags over it (expand immediately). */
const EXPAND_ON_DRAG_DURATION_SEC = 10;
// Reserve space so last ruler label is not clipped (start label removed)
const RULER_PADDING_LEFT = 0;
const RULER_PADDING_RIGHT = 28;
/** Min horizontal spacing (px) between time labels to avoid overlap. */
const MIN_RULER_LABEL_SPACING_PX = 56;
/** Keep playhead at least this many px from the viewport edge when auto-scrolling. */
const PLAYHEAD_SCROLL_MARGIN_PX = 48;

/** Number of segments shown across the visible track width. Each segment = one unit of the chosen duration. */
const SEGMENTS_VISIBLE = 5;
/** Zoom levels: duration per segment in seconds. Viewport shows SEGMENTS_VISIBLE segments (e.g. 5 × 1min = 5 min). */
const SEC = 1;
const MIN = 60;
const ZOOM_LEVELS_SEC: number[] = [
  1 * SEC, 5 * SEC, 10 * SEC, 15 * SEC, 30 * SEC,
  1 * MIN, 3 * MIN, 5 * MIN, 10 * MIN,  // 1min, 3min, 5min, 10min in seconds
];
const DEFAULT_ZOOM_INDEX = 4; // 30 seconds per segment → 5 × 30s = 2.5 min in view

function formatRulerTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatSegmentLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}m`;
}

interface TimelineBlockProps {
  block: TimelineNode & { start: number };
  pixelsPerSecond: number;
  isSelected: boolean;
  onResize: (newDuration: number) => void;
  onMove: (newStartTime: number, trackIndex?: number) => void;
  onSelect: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMoveStart?: () => void;
  onMoveEnd?: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

function TimelineBlock({ block, pixelsPerSecond, isSelected, onResize, onMove, onSelect, onContextMenu, onMoveStart, onMoveEnd, onResizeStart, onResizeEnd }: TimelineBlockProps) {
  const startX = useRef(0);
  const startDuration = useRef(0);
  const startStartTime = useRef(0);
  const [liveDuration, setLiveDuration] = useState<number | null>(null);

  const displayDuration = liveDuration ?? block.duration;
  const displayStart = block.start;
  const displayWidth = Math.max(MIN_BLOCK_WIDTH_PX, displayDuration * pixelsPerSecond - 4);
  const displayLeft = RULER_PADDING_LEFT + displayStart * pixelsPerSecond;

  const handleMoveStart = useCallback(
    (e: React.PointerEvent) => {
      if (pixelsPerSecond <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      onMoveStart?.();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      startX.current = e.clientX;
      startStartTime.current = block.start;
      const moveHandler = (ev: PointerEvent) => {
        const deltaPx = ev.clientX - startX.current;
        const deltaSec = deltaPx / pixelsPerSecond;
        const newStart = startStartTime.current + deltaSec;
        const trackEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-timeline-track]');
        const trackIndex = trackEl ? parseInt(trackEl.getAttribute('data-track-index') ?? '0', 10) : undefined;
        onMove(newStart, trackIndex);
      };
      const upHandler = () => {
        try {
          target.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        onMoveEnd?.();
        window.removeEventListener('pointermove', moveHandler);
        window.removeEventListener('pointerup', upHandler);
        window.removeEventListener('pointercancel', upHandler);
        window.removeEventListener('blur', upHandler);
        document.removeEventListener('visibilitychange', upHandler);
      };
      window.addEventListener('pointermove', moveHandler);
      window.addEventListener('pointerup', upHandler);
      window.addEventListener('pointercancel', upHandler);
      window.addEventListener('blur', upHandler);
      document.addEventListener('visibilitychange', upHandler);
    },
    [block.start, pixelsPerSecond, onMove, onMoveStart, onMoveEnd]
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      if (pixelsPerSecond <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      onResizeStart?.();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      startX.current = e.clientX;
      startDuration.current = block.duration;
      setLiveDuration(block.duration);
      const moveHandler = (ev: PointerEvent) => {
        const deltaPx = ev.clientX - startX.current;
        const deltaSec = deltaPx / pixelsPerSecond;
        const newDuration = Math.max(MIN_BLOCK_DURATION_SEC, startDuration.current + deltaSec);
        setLiveDuration(newDuration);
      };
      const upHandler = () => {
        try {
          target.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        onResizeEnd?.();
        window.removeEventListener('pointermove', moveHandler);
        window.removeEventListener('pointerup', upHandler);
        window.removeEventListener('pointercancel', upHandler);
        window.removeEventListener('blur', upHandler);
        document.removeEventListener('visibilitychange', upHandler);
        setLiveDuration((prev) => {
          if (prev !== null) onResize(prev);
          return null;
        });
      };
      window.addEventListener('pointermove', moveHandler);
      window.addEventListener('pointerup', upHandler);
      window.addEventListener('pointercancel', upHandler);
      window.addEventListener('blur', upHandler);
      document.addEventListener('visibilitychange', upHandler);
    },
    [block.duration, pixelsPerSecond, onResize, onResizeStart, onResizeEnd]
  );

  return (
    <div
      data-timeline-block
      className={`absolute top-0 bottom-0 rounded-lg flex items-center overflow-hidden group select-none transition-shadow ${
        isSelected
          ? 'bg-emerald-500 dark:bg-emerald-600 border-2 border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-400/50'
          : 'bg-emerald-600 dark:bg-emerald-700 border border-emerald-500/50 hover:ring-2 hover:ring-emerald-400/50'
      }`}
      style={{ left: displayLeft, width: displayWidth, height: '100%' }}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      <div
        className="flex-1 min-w-0 flex flex-col justify-center px-2 cursor-grab active:cursor-grabbing touch-none py-1"
        style={{ touchAction: 'none' }}
        onPointerDown={handleMoveStart}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-white truncate">{block.label ?? block.type}</span>
          <span className="text-xs text-white/70 flex-shrink-0">{displayDuration.toFixed(1)}s</span>
        </div>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize clip"
        onPointerDown={handleResizeStart}
        onClick={(e) => e.stopPropagation()}
        className="w-2 flex-shrink-0 self-stretch flex items-center justify-center cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500/70"
      >
        <div className="w-0.5 h-4 rounded-full bg-white/40 group-hover:bg-white/70" />
      </div>
    </div>
  );
}

type ContextMenu = { x: number; y: number; blockId: string } | null;
type TrackContextMenu = { x: number; y: number; trackIndex: number } | null;

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
    updateTimelineNode,
    moveTimelineNodeWithPush,
    moveTimelineGroupWithPush,
    removeTimelineNodes,
    recordForUndo,
    setRecordingSuspended,
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
  const [dropTargetTrackIndex, setDropTargetTrackIndex] = useState(0);
  const [trackContextMenu, setTrackContextMenu] = useState<TrackContextMenu>(null);
  const [zoomLevelIndex, setZoomLevelIndex] = useState(DEFAULT_ZOOM_INDEX);
  const trackScrollRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const root = project?.root;
  const activeTimeline = root ? getActiveTimeline(root) : null;
  const items: TimelineNode[] = activeTimeline?.items ?? [];
  const timelines = root?.timelines ?? [];
  const activeTimelineId = root?.activeTimelineId;
  const { timelineDuration: totalDuration, maxEnd } = useTimelineDuration();
  // When empty + dragOver: expand immediately to show drop zone; else use totalDuration
  const effectiveDuration = items.length === 0
    ? (dragOver ? EXPAND_ON_DRAG_DURATION_SEC : 0)
    : totalDuration;
  const visibleDuration = ZOOM_LEVELS_SEC[zoomLevelIndex];
  const visibleTrackWidth = Math.max(0, containerWidth - RULER_PADDING_LEFT - RULER_PADDING_RIGHT);
  /** Total time shown in the viewport = 5 segments of visibleDuration each. */
  const viewportDuration = SEGMENTS_VISIBLE * visibleDuration;
  const pixelsPerSecond = visibleTrackWidth > 0 && viewportDuration > 0 ? visibleTrackWidth / viewportDuration : 0;
  /** Track is at least 5 segments wide; extend when timeline is longer. */
  const minTrackWidthForFiveSegments = visibleTrackWidth;
  const trackContentWidth = Math.max(
    minTrackWidthForFiveSegments,
    effectiveDuration > 0 ? effectiveDuration * pixelsPerSecond : 0
  );

  /** Convert seconds (0 = start of timeline) to pixel left position. */
  function timeToLeft(sec: number) {
    return RULER_PADDING_LEFT + sec * pixelsPerSecond;
  }

  /** Get playhead pixel position in content coordinates. */
  function getPlayheadLeft() {
    return timeToLeft(videoTime);
  }

  /** Convert pixel x (within track) to seconds. */
  function leftToTime(left: number) {
    if (pixelsPerSecond <= 0) return 0;
    const localX = left - RULER_PADDING_LEFT;
    return Math.max(0, Math.min(localX / pixelsPerSecond, maxEnd));
  }

  const playheadHandleRef = useRef<HTMLDivElement>(null);
  const handlePlayheadPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (pixelsPerSecond <= 0 || effectiveDuration <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      const scrollEl = trackScrollRef.current;
      const moveHandler = (ev: PointerEvent) => {
        if (!scrollEl) return;
        const rect = scrollEl.getBoundingClientRect();
        const contentX = scrollEl.scrollLeft + (ev.clientX - rect.left);
        const sec = leftToTime(contentX);
        setVideoTime(sec);
      };
      const upHandler = () => {
        try {
          target.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        window.removeEventListener('pointermove', moveHandler);
        window.removeEventListener('pointerup', upHandler);
        window.removeEventListener('pointercancel', upHandler);
      };
      window.addEventListener('pointermove', moveHandler);
      window.addEventListener('pointerup', upHandler);
      window.addEventListener('pointercancel', upHandler);
    },
    [pixelsPerSecond, effectiveDuration, maxEnd, setVideoTime]
  );

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const updateWidth = () => {
      setContainerWidth(Math.max(0, el.clientWidth - TRACK_LABEL_WIDTH_PX));
    };
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    updateWidth();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const scrollEl = trackScrollRef.current;
    if (!scrollEl || pixelsPerSecond <= 0) return;
    const playheadLeft = RULER_PADDING_LEFT + videoTime * pixelsPerSecond;
    const viewportW = scrollEl.clientWidth;
    const scrollLeft = scrollEl.scrollLeft;
    if (playheadLeft < scrollLeft + PLAYHEAD_SCROLL_MARGIN_PX) {
      scrollEl.scrollLeft = Math.max(0, playheadLeft - PLAYHEAD_SCROLL_MARGIN_PX);
    } else if (playheadLeft > scrollLeft + viewportW - PLAYHEAD_SCROLL_MARGIN_PX) {
      scrollEl.scrollLeft = playheadLeft - viewportW + PLAYHEAD_SCROLL_MARGIN_PX;
    }
  }, [videoTime, pixelsPerSecond]);

  useEffect(() => {
    function closeContextMenu() {
      setContextMenu(null);
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

  const rulerMarks = (() => {
    const step = visibleDuration;
    const marks: number[] = [];
    const maxSec = Math.max(effectiveDuration, viewportDuration);
    for (let s = 0; s <= maxSec; s += step) marks.push(s);
    if (marks.length > 0 && marks[marks.length - 1] < maxSec) marks.push(maxSec);
    return marks;
  })();

  /** Ruler marks that get a time label (skip when too close to previous to avoid overlap). */
  const rulerLabelsToShow = (() => {
    const withPos = rulerMarks.filter((sec) => sec > 0).map((sec) => ({ sec, left: timeToLeft(sec) }));
    let lastLeft = -Infinity;
    return withPos
      .filter(({ left }) => {
        if (left - lastLeft >= MIN_RULER_LABEL_SPACING_PX) {
          lastLeft = left;
          return true;
        }
        return false;
      })
      .map(({ sec }) => sec);
  })();

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
    const mediaData = getDragMediaData(e.dataTransfer);
    if (mediaData) {
      const duration = mediaData.type === 'video' ? 10 : mediaData.type === 'text' ? 5 : 3;
      addTimelineNode({
        type: mediaData.type,
        duration,
        label: mediaData.label,
        mediaPath: mediaData.path,
        ...(mediaData.type === 'text' && {
          text: mediaData.label,
          backgroundColor: '#ffffff',
          textColor: '#000000',
        }),
        trackIndex,
      });
      return;
    }
    const node = getDragNodeData(e.dataTransfer);
    if (node) addTimelineNode({ ...node, trackIndex });
  }

  const blocks = items.map((node, idx) => {
    const start = node.startTime ?? (idx === 0 ? 0 : items.slice(0, idx).reduce((s, n) => s + n.duration, 0));
    return { ...node, start };
  });
  const sortedBlocks = [...blocks].sort((a, b) => a.start - b.start);
  const sortedIds = sortedBlocks.map((b) => b.id);
  /** Number of tracks: at least trackCount from timeline, or from items, or 1. */
  const maxTrackFromItems = blocks.length > 0
    ? Math.max(...blocks.map((b) => (b.trackIndex ?? 0) + 1))
    : 0;
  const trackCount = Math.max(activeTimeline?.trackCount ?? 0, maxTrackFromItems, 1);
  /** Track indices 0..N-1; render bottom-to-top (0 = bottom = layer 1, N-1 = top). */
  const trackIndices = Array.from({ length: trackCount }, (_, i) => i);
  const trackIndicesBottomToTop = [...trackIndices].reverse();
  const TRACK_HEIGHT_PX = 56;
  const TRACK_LABEL_WIDTH_PX = 48;

  function handleBlockSelect(blockId: string) {
    return (e: React.MouseEvent) => {
      setSelection(blockId, e.shiftKey, sortedIds);
    };
  }

  function handleBlockContextMenu(blockId: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isSelected(blockId)) setSelection(blockId, false, sortedIds);
      setContextMenu({ x: e.clientX, y: e.clientY, blockId });
    };
  }

  function handleBlockMove(blockId: string) {
    return (newStartTime: number, trackIndex?: number) => {
      if (selectedIds.length > 1 && selectedIds.includes(blockId)) {
        moveTimelineGroupWithPush(blockId, newStartTime, selectedIds, trackIndex);
      } else {
        moveTimelineNodeWithPush(blockId, newStartTime, trackIndex);
      }
    };
  }

  function handleDeleteSelected() {
    removeTimelineNodes(selectedIds);
    clearSelection();
    setContextMenu(null);
  }

  return (
    <>
    <section
      className="flex flex-col flex-shrink-0 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d] min-h-[160px] max-h-[240px] pb-0.5"
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
        className="timeline-scroll-area flex min-h-0 max-h-[208px] overflow-auto border-b border-slate-200 dark:border-white/10"
      >
        <div className="flex flex-shrink-0 min-h-0 w-full min-w-0 max-w-full">
        <div
          className="flex flex-col flex-shrink-0 border-r border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#252525]"
          style={{ width: TRACK_LABEL_WIDTH_PX }}
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
              className="flex items-center justify-center border-b border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-white/50 font-medium cursor-context-menu hover:bg-slate-200 dark:hover:bg-[#383838]"
              style={{ height: TRACK_HEIGHT_PX }}
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
        <div
          ref={trackScrollRef}
          className="flex-1 min-w-0 min-h-0 overflow-x-auto overflow-y-auto flex flex-col relative timeline-scroll-area"
        >
          <div
            className="flex flex-col flex-shrink-0 relative"
            style={{ width: trackContentWidth, minWidth: '100%' }}
          >
            {effectiveDuration > 0 ? (
              <div
                role="button"
                tabIndex={0}
                className="relative flex h-7 flex-shrink-0 items-end text-xs text-slate-500 dark:text-white/50 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#252525] cursor-pointer"
                onClick={(e) => {
                  if (pixelsPerSecond <= 0) return;
                  const scrollEl = trackScrollRef.current;
                  if (!scrollEl) return;
                  const rect = scrollEl.getBoundingClientRect();
                  const contentX = scrollEl.scrollLeft + (e.clientX - rect.left);
                  const sec = leftToTime(contentX);
                  setVideoTime(Math.max(0, Math.min(sec, maxEnd)));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).click();
                  }
                }}
                aria-label={t('editor.timeline.clickToSeek', 'Click to move playhead')}
              >
                {rulerMarks.map((sec) => (
                  <div
                    key={sec}
                    className="absolute top-0 bottom-0 border-l border-slate-200 dark:border-white/10 pointer-events-none"
                    style={{ left: timeToLeft(sec) }}
                  />
                ))}
                {rulerLabelsToShow.map((sec) => (
                  <span
                    key={sec}
                    className="absolute -translate-x-1/2 tabular-nums pointer-events-none"
                    style={{ left: timeToLeft(sec), bottom: 4 }}
                  >
                    {formatRulerTime(sec)}
                  </span>
                ))}
              </div>
            ) : (
              <div
                className="h-7 flex-shrink-0 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#252525] cursor-pointer"
                aria-hidden
                onClick={(e) => {
                  if (pixelsPerSecond <= 0) return;
                  const scrollEl = trackScrollRef.current;
                  if (!scrollEl) return;
                  const rect = scrollEl.getBoundingClientRect();
                  const contentX = scrollEl.scrollLeft + (e.clientX - rect.left);
                  const sec = leftToTime(contentX);
                  setVideoTime(Math.max(0, Math.min(sec, maxEnd)));
                }}
              />
            )}
            <div className="relative flex flex-col flex-shrink-0">
              {trackIndicesBottomToTop.map((trackIdx) => (
                <div
                  key={trackIdx}
                  data-timeline-track
                  data-track-index={trackIdx}
                  onDragOver={() => setDropTargetTrackIndex(trackIdx)}
                  className={`relative flex-shrink-0 flex items-center border-b border-slate-200 dark:border-white/10 ${dragOver ? 'bg-emerald-500/5' : 'bg-slate-50 dark:bg-[#252525]'}`}
                  style={{ height: TRACK_HEIGHT_PX }}
                  onClick={(e) => {
                    if (pixelsPerSecond <= 0) return;
                    const target = e.target as HTMLElement;
                    if (!target.closest('[data-timeline-block]') && !target.closest('[data-playhead]')) {
                      clearSelection();
                      const scrollEl = trackScrollRef.current;
                      if (!scrollEl) return;
                      const rect = scrollEl.getBoundingClientRect();
                      const contentX = scrollEl.scrollLeft + (e.clientX - rect.left);
                      const sec = leftToTime(contentX);
                      const videoTimeAtClick = Math.max(0, Math.min(sec, maxEnd));
                      setVideoTime(videoTimeAtClick);
                    }
                  }}
                >
                  {blocks
                    .filter((b) => (b.trackIndex ?? 0) === trackIdx)
                    .map((block) => (
                      <TimelineBlock
                        key={block.id}
                        block={block}
                        pixelsPerSecond={pixelsPerSecond}
                        isSelected={isSelected(block.id)}
                        onResize={(newDuration) => updateTimelineNode(block.id, { duration: newDuration })}
                        onMove={handleBlockMove(block.id)}
                        onSelect={handleBlockSelect(block.id)}
                        onContextMenu={handleBlockContextMenu(block.id)}
                        onMoveStart={() => {
                          recordForUndo();
                          setRecordingSuspended(true);
                        }}
                        onMoveEnd={() => setRecordingSuspended(false)}
                        onResizeStart={() => {
                          recordForUndo();
                          setRecordingSuspended(true);
                        }}
                        onResizeEnd={() => setRecordingSuspended(false)}
                      />
                    ))}
                </div>
              ))}
              {items.length === 0 && trackCount <= 1 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className={`text-sm ${dragOver ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-white/50'}`}>
                    {t('editor.timeline.dropMedia', 'Drag and drop media here')}
                  </p>
                </div>
              )}
            </div>
              {pixelsPerSecond > 0 && (
                <div
                  data-playhead
                  ref={playheadHandleRef}
                  role="slider"
                  aria-label="Timeline playhead"
                  aria-valuemin={0}
                  aria-valuemax={maxEnd}
                  aria-valuenow={videoTime}
                  className="absolute top-0 bottom-0 z-10 flex flex-col items-center cursor-ew-resize"
                  style={{ left: getPlayheadLeft(), transform: 'translateX(-50%)', width: 12, touchAction: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={handlePlayheadPointerDown}
                >
                  <div className="w-3 h-2.5 flex-shrink-0 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-400 clip-path-[polygon(50%_0,100%_100%,0_100%)] pointer-events-none" />
                  <div className="flex-1 w-0.5 bg-emerald-500 min-h-0 pointer-events-none" />
                </div>
              )}
          </div>
        </div>
        </div>
      </div>
    </section>
    {contextMenu && (
      <div
        className="fixed z-50 min-w-[160px] py-1 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
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
    {trackContextMenu !== null && (
      <div
        className="fixed z-50 min-w-[160px] py-1 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d]"
        style={{ left: trackContextMenu.x, top: trackContextMenu.y }}
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
