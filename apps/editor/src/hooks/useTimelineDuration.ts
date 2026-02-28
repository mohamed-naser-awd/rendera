import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { getActiveTimeline } from '../stores/projectStore';
import { usePlaybackStore } from '../stores/playbackStore';

/** Extra seconds at end of timeline for drag-and-drop space. */
const EXTRA_DROP_SPACE_SEC = 10;

/**
 * Timeline duration = full timeline length (of active timeline).
 * Empty (0) when no media. When items exist: maxEnd + extra drop space.
 * Timeline never shrinks; only expands when items move or grow.
 */
export function useTimelineDuration() {
  const project = useProjectStore((s) => s.project);
  const root = project?.root;
  const activeTimeline = root ? getActiveTimeline(root) : null;
  const items = activeTimeline?.items ?? [];
  const maxEnd = items.length > 0
    ? Math.max(...items.map((n) => (n.startTime ?? 0) + n.duration))
    : 0;
  const computedDuration = items.length > 0 ? maxEnd + EXTRA_DROP_SPACE_SEC : 0;

  const { maxTimelineDurationSeen, setMaxTimelineDurationIfGreater, resetMaxTimelineDuration } =
    usePlaybackStore();
  const prevProjectIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!project?.id || items.length === 0) {
      resetMaxTimelineDuration();
      return;
    }
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      resetMaxTimelineDuration();
    } else if (computedDuration > maxTimelineDurationSeen) {
      setMaxTimelineDurationIfGreater(computedDuration);
    }
  }, [project?.id, items.length, computedDuration, maxTimelineDurationSeen, setMaxTimelineDurationIfGreater, resetMaxTimelineDuration]);

  const timelineDuration = items.length > 0 ? Math.max(computedDuration, maxTimelineDurationSeen) : 0;

  return { timelineDuration, maxEnd };
}
