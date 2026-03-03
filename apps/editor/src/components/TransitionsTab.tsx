import { useTranslation } from 'react-i18next';
import { FFMPEG_XFADE_TRANSITIONS, type TransitionId } from '@/lib/transitions';
import { useProjectStore } from '@/stores/projectStore';
import { useTimelineSelectionStore } from '@/stores/timelineSelectionStore';
import { getActiveTimeline } from '@/stores/projectStore';
import { DEFAULT_TRANSITION_DURATION } from '@/lib/transitions';
import { setDragTransitionData } from './NodePalette';

export function TransitionsTab() {
  const { t } = useTranslation();
  const { project, updateTimelineNode } = useProjectStore();
  const { selectedIds } = useTimelineSelectionStore();

  const root = project?.root;
  const activeTimeline = root ? getActiveTimeline(root) : null;
  const items = activeTimeline?.items ?? [];
  const blocks = items.map((node, idx) => ({
    ...node,
    start: node.startTime ?? (idx === 0 ? 0 : items.slice(0, idx).reduce((s, n) => s + n.duration, 0)),
  }));
  const selectedBlock = selectedIds.length === 1 ? blocks.find((b) => b.id === selectedIds[0]) : null;

  const handleApplyTransition = (transitionId: TransitionId) => {
    if (!selectedBlock) return;
    updateTimelineNode(selectedBlock.id, {
      transitionOut: { type: transitionId, duration: selectedBlock.transitionOut?.duration ?? DEFAULT_TRANSITION_DURATION },
    });
  };

  const handleClearTransition = () => {
    if (!selectedBlock) return;
    updateTimelineNode(selectedBlock.id, { transitionOut: undefined });
  };

  const handleDragStart = (e: React.DragEvent, trans: (typeof FFMPEG_XFADE_TRANSITIONS)[number]) => {
    setDragTransitionData(e.dataTransfer, {
      transitionId: trans.id,
      requiresTwoVideos: trans.requiresTwoVideos,
    });
    e.dataTransfer.effectAllowed = 'copy';
    if (e.dataTransfer.setDragImage) {
      const el = document.createElement('div');
      el.className = 'w-2 h-12 rounded-md bg-teal-500 dark:bg-teal-400 shadow-lg pointer-events-none';
      el.style.position = 'absolute';
      el.style.top = '-9999px';
      el.style.left = '0';
      document.body.appendChild(el);
      e.dataTransfer.setDragImage(el, 4, 24);
      setTimeout(() => { try { document.body.removeChild(el); } catch { /* already removed */ } }, 0);
    }
  };

  return (
    <div className="space-y-3">
      {selectedBlock ? (
        <p className="text-xs text-slate-600 dark:text-white/70">
          {t('editor.transitions.selectedClip', 'Selected clip')}: {selectedBlock.label || selectedBlock.id.slice(0, 12)}…
        </p>
      ) : (
        <p className="text-xs text-slate-500 dark:text-white/50">
          {t('editor.transitions.selectClipToApply', 'Select a clip in the timeline to apply a transition.')}{' '}
          {t('editor.transitions.dragToTimeline', 'Or drag a transition and drop it between two adjacent clips.')}
        </p>
      )}
      {selectedBlock?.transitionOut && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            {t('editor.transitions.applied', 'Applied')}: {FFMPEG_XFADE_TRANSITIONS.find((tr) => tr.id === selectedBlock!.transitionOut!.type)?.label ?? selectedBlock.transitionOut.type}
          </span>
          <button
            type="button"
            onClick={handleClearTransition}
            className="text-xs text-slate-500 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400"
          >
            {t('editor.transitions.clear', 'Clear')}
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {FFMPEG_XFADE_TRANSITIONS.map((trans) => {
          const isActive = selectedBlock?.transitionOut?.type === trans.id;
          return (
            <button
              key={trans.id}
              type="button"
              draggable
              onDragStart={(e) => handleDragStart(e, trans)}
              onClick={() => handleApplyTransition(trans.id)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors text-left w-full cursor-grab active:cursor-grabbing ${
                isActive
                  ? 'bg-emerald-500/20 dark:bg-emerald-500/20 border-emerald-500/50'
                  : 'bg-slate-100 dark:bg-[#383838] border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-[#424242]'
              }`}
              title={trans.label}
            >
              <div className="w-full aspect-video rounded overflow-hidden bg-slate-800 relative">
                <div className={`transition-preview transition-preview-${trans.id}`} />
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-white/90 truncate w-full">
                {trans.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
