import { useCallback } from 'react';
import { useProjectStore, getActiveTimeline } from '@/stores/projectStore';
import { useTimelineSelectionStore } from '@/stores/timelineSelectionStore';
import { useClipboardStore, type ClipboardNode } from '@/stores/clipboardStore';
import { usePlaybackStore } from '@/stores/playbackStore';

export function useClipboardActions() {
  const { project, removeTimelineNodes, insertTimelineNodes } = useProjectStore();
  const { selectedIds, clearSelection } = useTimelineSelectionStore();
  const { setClipboard, nodes: clipboardNodes, hasClipboard } = useClipboardStore();
  const { videoTime } = usePlaybackStore();

  const copy = useCallback(() => {
    const root = project?.root;
    if (!root || selectedIds.length === 0) return false;
    const active = getActiveTimeline(root);
    if (!active) return false;
    const items = active.items;
    const blocks = items
      .map((node, idx) => ({
        ...node,
        start: node.startTime ?? (idx === 0 ? 0 : items.slice(0, idx).reduce((s, n) => s + n.duration, 0)),
      }))
      .filter((b) => selectedIds.includes(b.id))
      .sort((a, b) => a.start - b.start);
    if (blocks.length === 0) return false;
    const minStart = blocks[0].start;
    const clipboard: ClipboardNode[] = blocks.map((b) => ({
      node: {
        type: b.type,
        duration: b.duration,
        label: b.label,
        mediaPath: b.mediaPath,
        crop: b.crop,
        ...(b.type === 'text' && {
          text: b.text,
          backgroundColor: b.backgroundColor,
          backgroundColorTransparent: b.backgroundColorTransparent,
          textColor: b.textColor,
          fontSize: b.fontSize,
        }),
      },
      startOffset: b.start - minStart,
    }));
    setClipboard(clipboard);
    return true;
  }, [project, selectedIds, setClipboard]);

  const cut = useCallback(() => {
    if (!copy()) return false;
    removeTimelineNodes(selectedIds);
    clearSelection();
    return true;
  }, [copy, selectedIds, removeTimelineNodes, clearSelection]);

  const paste = useCallback(() => {
    if (clipboardNodes.length === 0) return false;
    insertTimelineNodes(
      clipboardNodes.map(({ node, startOffset }) => ({ node, startOffset })),
      videoTime
    );
    return true;
  }, [clipboardNodes, videoTime, insertTimelineNodes]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return false;
    removeTimelineNodes(selectedIds);
    clearSelection();
    return true;
  }, [selectedIds, removeTimelineNodes, clearSelection]);

  const canCopy = selectedIds.length > 0 && !!project;
  const canPaste = hasClipboard() && !!project;
  const canDelete = selectedIds.length > 0 && !!project;

  return { copy, cut, paste, deleteSelected, canCopy, canPaste, canDelete };
}
