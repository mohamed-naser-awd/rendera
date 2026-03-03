import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import type { TimelineNode, CropRect } from '@/stores/projectStore';
import { getApiBaseUrl } from '@shared/getApiUrl';

const DEFAULT_CROP: CropRect = { top: 0, right: 0, bottom: 0, left: 0 };

function getMediaPath(block: TimelineNode): string | undefined {
  if (block.type === 'stack' && Array.isArray(block.children) && block.children.length > 0) {
    const mediaChild = block.children.find((c) => c.type !== 'caption') ?? block.children[0];
    return mediaChild.mediaPath;
  }
  return block.mediaPath;
}

function useImageUrl(
  projectId: string | undefined,
  path: string | undefined,
  getPendingFile: (p: string) => File | undefined
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!projectId || !path) return;
    if (path.startsWith('pending:')) {
      const file = getPendingFile(path);
      if (file) {
        const u = URL.createObjectURL(file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
      }
      setUrl(null);
      return;
    }
    const filename = path.replace(/^media\//, '');
    getApiBaseUrl().then((base) => setUrl(`${base}/api/projects/${projectId}/media/${filename}`));
    return () => {};
  }, [projectId, path, getPendingFile]);
  return url;
}

type HandleId = 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const HANDLE_SIZE = 12;

function CropDialog({
  block,
  onSave,
  onClose,
}: {
  block: TimelineNode & { start?: number };
  onSave: (crop: CropRect) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { project, getPendingFile } = useProjectStore();
  const mediaPath = getMediaPath(block);
  const imageUrl = useImageUrl(project?.id, mediaPath, getPendingFile);

  const initial = block.crop ?? DEFAULT_CROP;
  const [crop, setCrop] = useState(initial);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragHandle, setDragHandle] = useState<HandleId | null>(null);
  const dragStart = useRef({ x: 0, y: 0, top: 0, right: 0, bottom: 0, left: 0 });
  const captureTarget = useRef<{ el: HTMLElement; id: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  const clampCrop = useCallback((c: CropRect): CropRect => ({
    top: Math.max(0, Math.min(100 - c.bottom, c.top)),
    right: Math.max(0, Math.min(100 - c.left, c.right)),
    bottom: Math.max(0, Math.min(100 - c.top, c.bottom)),
    left: Math.max(0, Math.min(100 - c.right, c.left)),
  }), []);

  const computeContainerSize = useCallback((naturalWidth: number, naturalHeight: number) => {
    if (naturalWidth <= 0 || naturalHeight <= 0) return { width: 400, height: 300 };
    const maxW = Math.min(window.innerWidth * 0.9, 1600);
    const maxH = Math.min((window.innerHeight - 140) * 0.9, 900);
    const scale = Math.min(maxW / naturalWidth, maxH / naturalHeight, 1);
    return {
      width: Math.round(naturalWidth * scale),
      height: Math.round(naturalHeight * scale),
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !dragHandle) return;
    const el = containerRef.current;
    const rect = () => el.getBoundingClientRect();

    const onMove = (e: PointerEvent) => {
      const r = rect();
      const w = r.width;
      const h = r.height;
      if (w <= 0 || h <= 0) return;
      const px = ((e.clientX - r.left) / w) * 100;
      const py = ((e.clientY - r.top) / h) * 100;

      setCrop((c) => {
        let top = c.top, right = c.right, bottom = c.bottom, left = c.left;
        switch (dragHandle) {
          case 'top':
            top = Math.max(0, Math.min(100 - bottom, py));
            break;
          case 'bottom':
            bottom = Math.max(0, Math.min(100 - top, 100 - py));
            break;
          case 'left':
            left = Math.max(0, Math.min(100 - right, px));
            break;
          case 'right':
            right = Math.max(0, Math.min(100 - left, 100 - px));
            break;
          case 'topLeft':
            top = Math.max(0, Math.min(100 - bottom, py));
            left = Math.max(0, Math.min(100 - right, px));
            break;
          case 'topRight':
            top = Math.max(0, Math.min(100 - bottom, py));
            right = Math.max(0, Math.min(100 - left, 100 - px));
            break;
          case 'bottomLeft':
            bottom = Math.max(0, Math.min(100 - top, 100 - py));
            left = Math.max(0, Math.min(100 - right, px));
            break;
          case 'bottomRight':
            bottom = Math.max(0, Math.min(100 - top, 100 - py));
            right = Math.max(0, Math.min(100 - left, 100 - px));
            break;
        }
        return clampCrop({ top, right, bottom, left });
      });
    };

    const onUp = () => {
      const c = captureTarget.current;
      if (c) {
        try {
          c.el.releasePointerCapture(c.id);
        } catch (_) {}
        captureTarget.current = null;
      }
      setDragHandle(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return onUp;
  }, [dragHandle, clampCrop]);

  const handlePointerDown = (handle: HandleId) => (e: React.PointerEvent) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    captureTarget.current = { el, id: e.pointerId };
    setDragHandle(handle);
    setCrop((c) => {
      dragStart.current = { x: e.clientX, y: e.clientY, top: c.top, right: c.right, bottom: c.bottom, left: c.left };
      return c;
    });
  };

  const handleSave = () => {
    const isDefault = crop.top === 0 && crop.right === 0 && crop.bottom === 0 && crop.left === 0;
    onSave(isDefault ? DEFAULT_CROP : crop);
    onClose();
  };

  const handleReset = () => setCrop(DEFAULT_CROP);

  if (!mediaPath) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d] shadow-xl p-4 max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-slate-600 dark:text-white/70">{t('editor.timeline.noMediaToCrop', 'No media to crop')}</p>
          <button type="button" onClick={onClose} className="mt-3 px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-500">
            {t('editor.timeline.close', 'Close')}
          </button>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d] shadow-xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-slate-600 dark:text-white/70">{t('editor.preview.loading', 'Loading…')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 mb-3 w-full">
          <h3 className="text-sm font-medium text-white">
            {t('editor.timeline.crop', 'Crop media')}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-sm rounded border border-white/30 text-white/90 hover:bg-white/10"
            >
              {t('editor.timeline.resetCrop', 'Reset')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded border border-white/30 text-white/90 hover:bg-white/10"
            >
              {t('editor.timeline.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {t('editor.timeline.apply', 'Apply')}
            </button>
          </div>
        </div>
        <p className="text-xs text-white/70 mb-2 self-start">
          {t('editor.timeline.cropHint', 'Drag the edges or corners to set the crop area.')}
        </p>
        <div
          ref={containerRef}
          className="relative bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0"
          style={
            containerSize
              ? { width: containerSize.width, height: containerSize.height }
              : { width: 400, height: 300 }
          }
        >
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setContainerSize(computeContainerSize(img.naturalWidth, img.naturalHeight));
              }
            }}
          />
          {/* Overlay frame: four dark bars around the crop area */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-0 right-0 top-0 bg-black/60" style={{ height: `${crop.top}%` }} />
            <div className="absolute left-0 right-0 bottom-0 bg-black/60" style={{ height: `${crop.bottom}%` }} />
            <div className="absolute left-0 bg-black/60" style={{ width: `${crop.left}%`, top: `${crop.top}%`, height: `${100 - crop.top - crop.bottom}%` }} />
            <div className="absolute right-0 bg-black/60" style={{ width: `${crop.right}%`, top: `${crop.top}%`, height: `${100 - crop.top - crop.bottom}%` }} />
          </div>
          {/* Crop rectangle border */}
          <div
            className="absolute border-2 border-white/90 pointer-events-none"
            style={{
              left: `${crop.left}%`,
              top: `${crop.top}%`,
              right: `${crop.right}%`,
              bottom: `${crop.bottom}%`,
            }}
          />
          {/* Resize handles: position at edges/corners, centered by transform */}
          {(['top', 'bottom', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as HandleId[]).map((handle) => {
            const cx = handle.includes('left') ? crop.left : handle.includes('right') ? 100 - crop.right : crop.left + (100 - crop.left - crop.right) / 2;
            const cy = handle.includes('top') ? crop.top : handle.includes('bottom') ? 100 - crop.bottom : crop.top + (100 - crop.top - crop.bottom) / 2;
            return (
              <div
                key={handle}
                role="slider"
                aria-label={handle}
                className="absolute bg-white rounded-sm border-2 border-emerald-500 shadow cursor-grab active:cursor-grabbing hover:bg-emerald-400/30 z-10"
                style={{
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  left: `${cx}%`,
                  top: `${cy}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onPointerDown={handlePointerDown(handle)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CropDialog;
