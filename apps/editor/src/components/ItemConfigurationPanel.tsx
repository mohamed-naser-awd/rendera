import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../stores/projectStore';
import { useTimelineSelectionStore } from '../stores/timelineSelectionStore';
import type { TimelineNode, CropRect, ObjectFit } from '../stores/projectStore';
import CropDialog from './CropDialog';

const OBJECT_FIT_OPTIONS: { value: ObjectFit; labelKey: string }[] = [
  { value: 'contain', labelKey: 'editor.item.fill.contain' },
  { value: 'cover', labelKey: 'editor.item.fill.cover' },
  { value: 'fill', labelKey: 'editor.item.fill.fill' },
  { value: 'none', labelKey: 'editor.item.fill.none' },
];

/** For a stack, return the first (media) child; otherwise return the node. */
function getMediaNode(node: TimelineNode): TimelineNode {
  if (node.type === 'stack' && Array.isArray(node.children) && node.children.length > 0) {
    return node.children[0];
  }
  return node;
}

export function ItemConfigurationPanel({
  block,
  onCloseCrop,
}: {
  block: TimelineNode & { start: number };
  onCloseCrop: () => void;
}) {
  const { t } = useTranslation();
  const { updateTimelineNode, updateStackChild, removeTimelineNodes } = useProjectStore();
  const { clearSelection } = useTimelineSelectionStore();
  const [showCrop, setShowCrop] = useState(false);

  const isStack = block.type === 'stack' && Array.isArray(block.children);
  const mediaNode = getMediaNode(block);
  const mediaBlock = { ...mediaNode, start: block.start };

  const handleCropSave = (crop: CropRect) => {
    if (isStack && block.children?.length) {
      updateStackChild(block.id, mediaNode.id, { crop });
    } else {
      const isDefault = crop.top === 0 && crop.right === 0 && crop.bottom === 0 && crop.left === 0;
      updateTimelineNode(block.id, { crop: isDefault ? null : crop });
    }
    setShowCrop(false);
    onCloseCrop();
  };

  const trackIndex = block.trackIndex ?? 0;
  const objectFit = mediaNode.objectFit ?? 'contain';
  const scale = mediaNode.scale ?? 1;
  const isText = block.type === 'text';

  const setMedia = (updates: { objectFit?: ObjectFit; scale?: number }) => {
    if (isStack && block.children?.length) {
      updateStackChild(block.id, mediaNode.id, updates);
    } else {
      updateTimelineNode(block.id, updates);
    }
  };

  const handleDelete = () => {
    removeTimelineNodes([block.id]);
    clearSelection();
  };

  if (isText) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-600 dark:text-white/70 uppercase tracking-wide">
            {t('editor.item.textConfiguration', 'Text configuration')}
          </h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
              {t('editor.item.text', 'Text')}
            </label>
            <input
              type="text"
              value={block.text ?? ''}
              onChange={(e) => updateTimelineNode(block.id, { text: e.target.value })}
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
                value={block.backgroundColor ?? '#ffffff'}
                onChange={(e) => updateTimelineNode(block.id, { backgroundColor: e.target.value })}
                disabled={block.backgroundColorTransparent}
                className="w-10 h-9 rounded border border-slate-300 dark:border-white/20 cursor-pointer bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={block.backgroundColor ?? '#ffffff'}
                  onChange={(e) => updateTimelineNode(block.id, { backgroundColor: e.target.value })}
                  disabled={block.backgroundColorTransparent}
                  className="w-full pl-3 pr-10 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => updateTimelineNode(block.id, { backgroundColorTransparent: !block.backgroundColorTransparent })}
                  title={block.backgroundColorTransparent ? t('editor.item.bgSolid', 'Solid background') : t('editor.item.bgTransparent', 'Transparent background')}
                  className={`absolute right-2 p-1 rounded transition-colors ${
                    block.backgroundColorTransparent
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    {block.backgroundColorTransparent ? (
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
                value={block.textColor ?? '#000000'}
                onChange={(e) => updateTimelineNode(block.id, { textColor: e.target.value })}
                className="w-10 h-9 rounded border border-slate-300 dark:border-white/20 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={block.textColor ?? '#000000'}
                onChange={(e) => updateTimelineNode(block.id, { textColor: e.target.value })}
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
              value={block.fontSize ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? undefined : Number(e.target.value);
                updateTimelineNode(block.id, { fontSize: v === undefined || Number.isNaN(v) ? undefined : Math.max(8, Math.min(400, v)) });
              }}
              placeholder={t('editor.item.fontSizePlaceholder', 'Auto (fit to word)')}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
              {t('editor.item.duration', 'Duration')} (s)
            </label>
            <input
              type="number"
              min={0.5}
              step={1}
              value={block.duration}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) updateTimelineNode(block.id, { duration: Math.max(0.5, v) });
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4m1 4h.01M12 4h.01M17 4v.01M7 4v.01" />
            </svg>
            {t('editor.timeline.delete', 'Delete')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video configuration (default section) */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-600 dark:text-white/70 uppercase tracking-wide">
          {t('editor.item.videoConfiguration', 'Video configuration')}
        </h3>
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
              if (!Number.isNaN(v)) setMedia({ scale: Math.max(10, Math.min(300, v)) / 100 });
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
            onChange={(e) => setMedia({ objectFit: e.target.value as ObjectFit })}
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

      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
          {t('editor.item.track', 'Track')}
        </label>
        <input
          type="number"
          min={0}
          value={trackIndex}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) updateTimelineNode(block.id, { trackIndex: Math.max(0, v) });
          }}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-white/70 mb-1">
          {t('editor.item.duration', 'Duration')} (s)
        </label>
        <input
          type="number"
          min={0.5}
          step={1}
          value={block.duration}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) updateTimelineNode(block.id, { duration: Math.max(0.5, v) });
          }}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

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
        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4m1 4h.01M12 4h.01M17 4v.01M7 4v.01" />
          </svg>
          {t('editor.timeline.delete', 'Delete')}
        </button>
      </div>

      {showCrop && (
        <CropDialog
          block={mediaBlock}
          onSave={handleCropSave}
          onClose={() => { setShowCrop(false); onCloseCrop(); }}
        />
      )}
    </div>
  );
}
