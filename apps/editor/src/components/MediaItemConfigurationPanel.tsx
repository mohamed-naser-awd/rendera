import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import type { MediaItem, CropRect, ObjectFit } from '@/stores/projectStore';
import CropDialog from './CropDialog';

const OBJECT_FIT_OPTIONS: { value: ObjectFit; labelKey: string }[] = [
  { value: 'contain', labelKey: 'editor.item.fill.contain' },
  { value: 'cover', labelKey: 'editor.item.fill.cover' },
  { value: 'fill', labelKey: 'editor.item.fill.fill' },
  { value: 'none', labelKey: 'editor.item.fill.none' },
];

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv)$/i;

function getMediaType(path: string): 'image' | 'video' | 'text' | 'other' {
  if (path.startsWith('text:')) return 'text';
  if (IMAGE_EXT.test(path) || path.toLowerCase().endsWith('.gif')) return 'image';
  if (VIDEO_EXT.test(path)) return 'video';
  return 'other';
}

export function MediaItemConfigurationPanel({ mediaItem }: { mediaItem: MediaItem }) {
  const { t } = useTranslation();
  const { project, updateMediaItem, saveProject, loadProject, isDirty } = useProjectStore();
  const [showCrop, setShowCrop] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = async () => {
    if (!isDirty) return;
    setIsSaving(true);
    setShowSaved(false);
    try {
      await saveProject();
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (project) loadProject(project.id);
  };

  const path = mediaItem.path;
  const d = mediaItem.defaults ?? {};
  const mediaType = getMediaType(path);

  const setDefaults = (updates: Partial<MediaItem['defaults']>) => {
    updateMediaItem(path, {
      defaults: { ...d, ...updates },
    });
  };

  const isText = mediaType === 'text';
  const isImage = mediaType === 'image' || path.toLowerCase().endsWith('.gif');
  const objectFit = d.objectFit ?? 'contain';
  const scale = d.scale ?? 1;
  const duration = d.duration ?? (mediaType === 'video' ? 10 : isText ? 5 : 3);

  /** Synthetic block for CropDialog: media item has no id/start, so we pass path as id. */
  const syntheticBlock = {
    id: path,
    type: mediaType as string,
    duration: 1,
    mediaPath: path,
    crop: d.crop ?? undefined,
  };

  const handleCropSave = (crop: CropRect) => {
    const isDefault = crop.top === 0 && crop.right === 0 && crop.bottom === 0 && crop.left === 0;
    setDefaults({ crop: isDefault ? null : crop });
    setShowCrop(false);
  };

  if (isText) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-slate-600 dark:text-white/70 uppercase tracking-wide">
              {t('editor.media.details', 'Details')}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                title={t('editor.media.save', 'Save')}
                className="p-1.5 rounded text-slate-500 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : showSaved ? (
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={!isDirty}
                title={t('editor.media.cancel', 'Cancel')}
                className="p-1.5 rounded text-slate-500 dark:text-white/50 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/50">
            {t('editor.media.defaultsWhenAdded', 'These defaults apply when you add this text to the timeline.')}
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
              {t('editor.item.text', 'Text')}
            </label>
            <input
              type="text"
              value={d.text ?? ''}
              onChange={(e) => setDefaults({ text: e.target.value })}
              placeholder={t('editor.item.textPlaceholder', 'Enter text...')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
              {t('editor.item.backgroundColor', 'Background color')}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={d.backgroundColor ?? '#ffffff'}
                onChange={(e) => setDefaults({ backgroundColor: e.target.value })}
                disabled={d.backgroundColorTransparent}
                className="w-10 h-9 rounded border border-slate-300 dark:border-white/20 cursor-pointer bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={d.backgroundColor ?? '#ffffff'}
                  onChange={(e) => setDefaults({ backgroundColor: e.target.value })}
                  disabled={d.backgroundColorTransparent}
                  className="w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setDefaults({ backgroundColorTransparent: !d.backgroundColorTransparent })}
                  title={d.backgroundColorTransparent ? t('editor.item.bgSolid', 'Solid background') : t('editor.item.bgTransparent', 'Transparent background')}
                  className={`absolute right-2 p-1 rounded transition-colors ${
                    d.backgroundColorTransparent
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    {d.backgroundColorTransparent ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
              {t('editor.item.textColor', 'Text color')}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={d.textColor ?? '#000000'}
                onChange={(e) => setDefaults({ textColor: e.target.value })}
                className="w-10 h-9 rounded border border-slate-300 dark:border-white/20 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={d.textColor ?? '#000000'}
                onChange={(e) => setDefaults({ textColor: e.target.value })}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
              {t('editor.item.fontSize', 'Size')} (px)
            </label>
            <input
              type="number"
              min={8}
              max={400}
              step={2}
              value={d.fontSize ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value);
                setDefaults({ fontSize: v === undefined || Number.isNaN(v) ? undefined : Math.max(8, Math.min(400, v)) });
              }}
              placeholder={t('editor.item.fontSizePlaceholder', 'Auto (fit to word)')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
              {t('editor.item.duration', 'Default duration')} (s)
            </label>
            <input
              type="number"
              min={0.5}
              step={1}
              value={duration}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) setDefaults({ duration: Math.max(0.5, v) });
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-white/50">
        {t('editor.media.defaultsWhenAdded', 'These defaults apply when you add this media to the timeline.')}
      </p>
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-600 dark:text-white/70 uppercase tracking-wide">
          {t('editor.item.videoConfiguration', 'Video configuration')}
        </h3>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
            {t('editor.item.duration', 'Default duration')} (s)
          </label>
          <input
            type="number"
            min={0.5}
            step={1}
            value={duration}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) setDefaults({ duration: Math.max(0.5, v) });
            }}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
            {t('editor.item.size', 'Size')} (%)
          </label>
          <input
            type="number"
            min={10}
            max={300}
            step={5}
            value={Math.round(scale * 100)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v)) setDefaults({ scale: Math.max(10, Math.min(300, v)) / 100 });
            }}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
            {t('editor.item.fill', 'Fill')}
          </label>
          <select
            value={objectFit}
            onChange={(e) => setDefaults({ objectFit: e.target.value as ObjectFit })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {OBJECT_FIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey, opt.value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isImage && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowCrop(true)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-[#252525] text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#2d2d2d]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t('editor.timeline.crop', 'Crop')}
          </button>
        </div>
      )}

      {showCrop && (
        <CropDialog
          block={syntheticBlock}
          onSave={handleCropSave}
          onClose={() => setShowCrop(false)}
        />
      )}
    </div>
  );
}
