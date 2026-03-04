import { useTranslation } from 'react-i18next';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useProjectStore } from '@/stores/projectStore';

/** Global video/preview configuration shown when no timeline item is selected. */
export function VideoConfigurationPanel() {
  const { t } = useTranslation();
  const { emptyFill, setEmptyFill } = usePlaybackStore();
   const project = useProjectStore((s) => s.project);
   const updateProject = useProjectStore((s) => s.updateProject);

  const fps = project?.fps ?? 30;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-600 dark:text-white/70 uppercase tracking-wide">
          {t('editor.item.videoConfiguration', 'Video configuration')}
        </h3>
        <div className="mt-2 space-y-1">
          <label className="block text-xs font-medium text-slate-600 dark:text-white/70">
            {t('editor.project.fps', 'Frames per second')}
          </label>
          <input
            type="number"
            min={1}
            max={240}
            step={1}
            value={fps}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && project) {
                const clamped = Math.max(1, Math.min(240, v));
                updateProject({ fps: clamped });
              }
            }}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-2">
          {t('editor.preview.emptyFill', 'Empty fill')}
        </label>
        <p className="text-xs text-slate-500 dark:text-white/50 mb-2">
          {t('editor.preview.emptyFillDescription', 'Background when no clip is active in the preview.')}
        </p>
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <input
                  type="radio"
                  name="emptyFillType"
                  checked={emptyFill.type === 'color'}
                  onChange={() => setEmptyFill({ type: 'color', value: emptyFill.type === 'color' ? emptyFill.value : '#000000' })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-white/90">
                  {t('editor.preview.color', 'Color')}
                </span>
              </label>
              {emptyFill.type === 'color' && (
                <>
                  <input
                    type="color"
                    value={emptyFill.value}
                    onChange={(e) => setEmptyFill({ type: 'color', value: e.target.value })}
                    className="w-9 h-9 rounded border border-slate-300 dark:border-white/20 cursor-pointer p-0 flex-shrink-0"
                  />
                  <span className="text-sm text-slate-600 dark:text-white/70">{emptyFill.value}</span>
                </>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="emptyFillType"
                  checked={emptyFill.type === 'image'}
                  onChange={() => setEmptyFill({ type: 'image', url: emptyFill.type === 'image' ? emptyFill.url : '' })}
                  className="rounded"
                />
                <span className="text-sm text-slate-700 dark:text-white/90">
                  {t('editor.preview.image', 'Image URL…')}
                </span>
              </label>
              {emptyFill.type === 'image' && (
                <input
                  type="url"
                  value={emptyFill.url}
                  onChange={(e) => setEmptyFill({ type: 'image', url: e.target.value })}
                  placeholder={t('editor.preview.imageUrlPlaceholder', 'https://…')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
