/**
 * Wrapper around @xzdarcy/react-timeline-editor for the timeline section.
 * Converts between our TimelineNode format and the library's editorData/effects format.
 * Provides grid snapping and drag-line snapping to prevent overlapping items.
 * Uses local state during drag/resize to avoid parent re-renders for smooth interaction.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import type { TimelineRow, TimelineAction, TimelineEffect } from '@xzdarcy/timeline-engine';
import type { TimelineNode } from '../stores/projectStore';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';

/** Zoom levels: duration per scale segment in seconds. */
const ZOOM_LEVELS_SEC = [1, 5, 10, 15, 30, 60, 180, 300, 600];
const DEFAULT_ZOOM_INDEX = 4;

function itemsToEditorData(
  items: TimelineNode[],
  trackCount: number
): { editorData: TimelineRow[]; effects: Record<string, TimelineEffect> } {
  const effects: Record<string, TimelineEffect> = {};
  const trackMap = new Map<number, TimelineAction[]>();

  const blocks = items.map((node, idx) => {
    const start = node.startTime ?? (idx === 0 ? 0 : items.slice(0, idx).reduce((s, n) => s + n.duration, 0));
    return { ...node, start };
  });

  for (const block of blocks) {
    const trackIdx = block.trackIndex ?? 0;
    if (!trackMap.has(trackIdx)) trackMap.set(trackIdx, []);
    const start = block.startTime ?? (block as { start: number }).start;
    const end = start + block.duration;
    trackMap.get(trackIdx)!.push({
      id: block.id,
      start,
      end,
      effectId: block.id,
      selected: false,
    });
    effects[block.id] = { id: block.id, name: block.label ?? block.type ?? 'Clip' };
  }

  const maxTrack = Math.max(
    trackCount - 1,
    trackMap.size > 0 ? Math.max(...trackMap.keys()) : 0
  );
  const editorData: TimelineRow[] = [];
  for (let i = 0; i <= maxTrack; i++) {
    editorData.push({
      id: String(i),
      actions: trackMap.get(i) ?? [],
    });
  }
  if (editorData.length === 0) {
    editorData.push({ id: '0', actions: [] });
  }
  return { editorData, effects };
}

function editorDataToUpdates(
  editorData: TimelineRow[],
  prevItems: TimelineNode[]
): Array<{ id: string; startTime: number; duration: number; trackIndex: number }> {
  const updates: Array<{ id: string; startTime: number; duration: number; trackIndex: number }> = [];
  const prevMap = new Map(prevItems.map((n) => [n.id, n]));

  for (let trackIdx = 0; trackIdx < editorData.length; trackIdx++) {
    const row = editorData[trackIdx];
    for (const action of row.actions) {
      const prev = prevMap.get(action.id);
      const startTime = action.start;
      const duration = action.end - action.start;
      if (!prev || prev.startTime !== startTime || prev.duration !== duration || (prev.trackIndex ?? 0) !== trackIdx) {
        updates.push({ id: action.id, startTime, duration, trackIndex: trackIdx });
      }
    }
  }
  return updates;
}

export interface RteTimelineProps {
  items: TimelineNode[];
  trackCount: number;
  videoTime: number;
  onVideoTimeChange: (time: number) => void;
  onItemsChange: (updates: Array<{ id: string; startTime: number; duration: number; trackIndex: number }>) => void;
  selectedIds: string[];
  onSelect: (actionId: string, addToSelection: boolean) => void;
  onContextMenu: (actionId: string, e: React.MouseEvent) => void;
  /** Right-click on empty track area: (trackIndex, time, e) */
  onContextMenuRow?: (trackIndex: number, time: number, e: React.MouseEvent) => void;
  zoomLevelIndex?: number;
  onZoomChange?: (index: number) => void;
  recordForUndo?: () => void;
  setRecordingSuspended?: (suspend: boolean) => void;
  maxEnd: number;
  containerWidth: number;
}

export function RteTimeline({
  items,
  trackCount,
  videoTime,
  onVideoTimeChange,
  onItemsChange,
  selectedIds,
  onSelect,
  onContextMenu,
  onContextMenuRow,
  zoomLevelIndex = DEFAULT_ZOOM_INDEX,
  recordForUndo,
  setRecordingSuspended,
  maxEnd,
  containerWidth,
}: RteTimelineProps) {
  const ROW_HEIGHT = 48;
  const timelineRef = useRef<{ setTime: (t: number) => void; getTime: () => number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { editorData, effects } = itemsToEditorData(items, trackCount);
  const [localEditorData, setLocalEditorData] = useState<TimelineRow[] | null>(null);
  const localEditorDataRef = useRef<TimelineRow[] | null>(null);
  const isInteractingRef = useRef(false);
  const targetRowIndexRef = useRef<number | null>(null);
  const draggedActionIdRef = useRef<string | null>(null);
  const sourceRowIndexRef = useRef<number | null>(null);
  const mouseMoveCleanupRef = useRef<(() => void) | null>(null);

  // Sync selection into editorData
  const mergeSelection = useCallback(
    (data: TimelineRow[]): TimelineRow[] =>
      data.map((row) => ({
        ...row,
        actions: row.actions.map((a: TimelineAction) => ({ ...a, selected: selectedIds.includes(a.id) })),
      })),
    [selectedIds]
  );
  const editorDataWithSelection = mergeSelection(editorData);

  // Data to render: use local state during drag/resize for smooth interaction
  const dataToRender = localEditorData !== null ? mergeSelection(localEditorData) : editorDataWithSelection;

  // Sync videoTime to timeline cursor
  useEffect(() => {
    timelineRef.current?.setTime(videoTime);
  }, [videoTime]);

  // Clear local state when items change externally (e.g. undo)
  useEffect(() => {
    if (!isInteractingRef.current) setLocalEditorData(null);
  }, [items]);

  // Cleanup mouse listener on unmount
  useEffect(() => () => mouseMoveCleanupRef.current?.(), []);

  const scale = ZOOM_LEVELS_SEC[Math.min(zoomLevelIndex, ZOOM_LEVELS_SEC.length - 1)] ?? 30;
  const minScaleCount = 5;
  const scaleWidth = Math.max(20, containerWidth / minScaleCount);

  const handleChange = useCallback(
    (newData: TimelineRow[]) => {
      if (isInteractingRef.current) {
        localEditorDataRef.current = newData;
        setLocalEditorData(newData);
      } else {
        const updates = editorDataToUpdates(newData, items);
        if (updates.length > 0) onItemsChange(updates);
      }
    },
    [items, onItemsChange]
  );

  const handleClickAction = useCallback(
    (e: React.MouseEvent<HTMLElement>, param: { action: TimelineAction; row: TimelineRow }) => {
      onSelect(param.action.id, e.shiftKey);
    },
    [onSelect]
  );

  const handleContextMenuAction = useCallback(
    (e: React.MouseEvent<HTMLElement>, param: { action: TimelineAction }) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(param.action.id, e);
    },
    [onContextMenu]
  );

  const handleContextMenuRow = useCallback(
    (e: React.MouseEvent<HTMLElement>, param: { row: TimelineRow; time: number }) => {
      e.preventDefault();
      e.stopPropagation();
      const trackIndex = editorData.findIndex((r) => r.id === param.row.id);
      if (trackIndex >= 0) onContextMenuRow?.(trackIndex, param.time, e);
    },
    [onContextMenuRow, editorData]
  );

  const handleClickTimeArea = useCallback(
    (time: number) => {
      onVideoTimeChange(Math.max(0, Math.min(time, maxEnd)));
      return true;
    },
    [onVideoTimeChange, maxEnd]
  );

  const handleCursorDrag = useCallback(
    (time: number) => {
      onVideoTimeChange(Math.max(0, Math.min(time, maxEnd)));
    },
    [onVideoTimeChange, maxEnd]
  );

  const getRowIndexFromClientY = useCallback((clientY: number): number | null => {
    const editArea = wrapperRef.current?.querySelector('.timeline-editor-edit-area');
    if (!editArea) return null;
    const rect = editArea.getBoundingClientRect();
    if (clientY < rect.top || clientY > rect.bottom) return null;
    const grid = editArea.querySelector('.ReactVirtualized__Grid') as HTMLElement | null;
    const scrollTop = grid?.scrollTop ?? (editArea as HTMLElement).scrollTop ?? 0;
    const relativeY = clientY - rect.top + scrollTop;
    const rowIndex = Math.floor(relativeY / ROW_HEIGHT);
    if (rowIndex < 0 || rowIndex >= editorData.length) return null;
    return rowIndex;
  }, [editorData.length]);

  const flushLocalToParent = useCallback(() => {
    let data = localEditorDataRef.current;
    localEditorDataRef.current = null;
    setLocalEditorData(null);

    // Cross-track move: if user dropped on a different row, move the action there
    const targetRow = targetRowIndexRef.current;
    const draggedId = draggedActionIdRef.current;
    const sourceRow = sourceRowIndexRef.current;
    targetRowIndexRef.current = null;
    draggedActionIdRef.current = null;
    sourceRowIndexRef.current = null;

    if (data !== null && draggedId != null && sourceRow != null && targetRow != null && targetRow !== sourceRow) {
      const action = data[sourceRow]?.actions.find((a) => a.id === draggedId);
      if (action) {
        data = data.map((row, rowIdx) => {
          if (rowIdx === sourceRow) {
            return { ...row, actions: row.actions.filter((a) => a.id !== draggedId) };
          }
          if (rowIdx === targetRow) {
            return { ...row, actions: [...row.actions, action] };
          }
          return row;
        });
      }
    }

    if (data !== null) {
      const updates = editorDataToUpdates(data, items);
      if (updates.length > 0) onItemsChange(updates);
    }
  }, [items, onItemsChange]);

  const handleActionMoveStart = useCallback(
    (params: { action: TimelineAction; row: TimelineRow }) => {
      isInteractingRef.current = true;
      localEditorDataRef.current = editorData;
      setLocalEditorData(editorData);
      draggedActionIdRef.current = params.action.id;
      sourceRowIndexRef.current = editorData.findIndex((r) => r.id === params.row.id);
      targetRowIndexRef.current = sourceRowIndexRef.current;

      const onMouseMove = (e: MouseEvent) => {
        const row = getRowIndexFromClientY(e.clientY);
        if (row !== null) targetRowIndexRef.current = row;
      };
      window.addEventListener('mousemove', onMouseMove);
      mouseMoveCleanupRef.current = () => window.removeEventListener('mousemove', onMouseMove);

      recordForUndo?.();
      setRecordingSuspended?.(true);
    },
    [recordForUndo, setRecordingSuspended, editorData, getRowIndexFromClientY]
  );

  const handleActionMoveEnd = useCallback(() => {
    mouseMoveCleanupRef.current?.();
    mouseMoveCleanupRef.current = null;
    isInteractingRef.current = false;
    flushLocalToParent();
    setRecordingSuspended?.(false);
  }, [setRecordingSuspended, flushLocalToParent]);

  const handleActionResizeStart = useCallback(() => {
    isInteractingRef.current = true;
    localEditorDataRef.current = editorData;
    setLocalEditorData(editorData);
    draggedActionIdRef.current = null; // Resize doesn't support cross-track
    sourceRowIndexRef.current = null;
    targetRowIndexRef.current = null;
    recordForUndo?.();
    setRecordingSuspended?.(true);
  }, [recordForUndo, setRecordingSuspended, editorData]);

  const handleActionResizeEnd = useCallback(() => {
    isInteractingRef.current = false;
    flushLocalToParent();
    setRecordingSuspended?.(false);
  }, [setRecordingSuspended, flushLocalToParent]);

  return (
    <div ref={wrapperRef} className="rte-timeline-wrapper flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
      <Timeline
        ref={(r) => {
          timelineRef.current = r;
        }}
        editorData={dataToRender}
        effects={effects}
        scale={scale}
        scaleWidth={scaleWidth}
        scaleSplitCount={5}
        minScaleCount={5}
        maxScaleCount={100}
        startLeft={0}
        rowHeight={48}
        gridSnap={false}
        dragLine={true}
        hideCursor={false}
        disableDrag={false}
        autoScroll={true}
        style={{ flex: 1, minHeight: 0, background: 'transparent' }}
        onChange={handleChange}
        onClickAction={handleClickAction}
        onContextMenuAction={handleContextMenuAction}
        onContextMenuRow={handleContextMenuRow}
        onClickTimeArea={handleClickTimeArea}
        onCursorDrag={handleCursorDrag}
        onCursorDragStart={handleCursorDrag}
        onCursorDragEnd={handleCursorDrag}
        onActionMoveStart={handleActionMoveStart}
        onActionMoveEnd={handleActionMoveEnd}
        onActionResizeStart={handleActionResizeStart}
        onActionResizeEnd={handleActionResizeEnd}
        getActionRender={(action) => {
          const effect = effects[action.effectId];
          const name = effect?.name ?? action.id;
          const duration = action.end - action.start;
          const stackIndex = items.find((n) => n.id === action.id)?.stackIndex ?? 1;
          const isSelected = (action as { selected?: boolean }).selected ?? selectedIds.includes(action.id);
          return (
            <div
              className={`flex items-center justify-between px-2 h-full rounded overflow-hidden bg-emerald-600 dark:bg-emerald-700 text-white text-xs border-2 ${
                isSelected
                  ? 'border-emerald-400 dark:border-emerald-300 ring-2 ring-emerald-400/30 dark:ring-emerald-300/30'
                  : 'border-transparent'
              }`}
              style={{ position: 'relative', zIndex: stackIndex }}
            >
              <span className="truncate flex-1 min-w-0">{name}</span>
              <span className="flex-shrink-0 ml-1 opacity-80">{duration.toFixed(1)}s</span>
            </div>
          );
        }}
      />
    </div>
  );
}
