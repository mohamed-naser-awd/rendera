import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { getActiveTimeline } from '@/stores/projectStore';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useTimelineSelectionStore } from '@/stores/timelineSelectionStore';
import { useMediaSelectionStore } from '@/stores/mediaSelectionStore';
import { getDragNodeData } from './NodePalette';
import { getApiBaseUrl } from '@shared/getApiUrl';
import type { TimelineNode } from '@/stores/projectStore';

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv)$/i;

function getMediaType(path: string, fileNameForType?: string): 'image' | 'video' | 'other' {
  const p = fileNameForType ?? path;
  if (IMAGE_EXT.test(p) || p.toLowerCase().endsWith('.gif')) return 'image';
  if (VIDEO_EXT.test(p)) return 'video';
  return 'other';
}

function useMediaUrl(projectId: string | undefined, path: string | undefined, getPendingFile: (p: string) => File | undefined): string | null {
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

/** Resolve media node from a block (flatten stack). */
function resolveBlock(block: TimelineNode | undefined): {
  mediaPath?: string;
  crop?: TimelineNode['crop'];
  objectFit?: TimelineNode['objectFit'];
  scale?: number;
  text?: string;
  backgroundColor?: string;
  backgroundColorTransparent?: boolean;
  textColor?: string;
  fontSize?: number;
} {
  if (!block) return {};
  if (block.type === 'stack' && Array.isArray(block.children) && block.children.length > 0) {
    const mediaChild = block.children.find((c) => c.type !== 'caption') ?? block.children[0];
    return {
      mediaPath: mediaChild.mediaPath,
      crop: mediaChild.crop,
      objectFit: mediaChild.objectFit,
      scale: mediaChild.scale,
      text: mediaChild.text,
      backgroundColor: mediaChild.backgroundColor,
      backgroundColorTransparent: mediaChild.backgroundColorTransparent,
      textColor: mediaChild.textColor,
      fontSize: mediaChild.fontSize,
    };
  }
  return {
    mediaPath: block.mediaPath,
    crop: block.crop,
    objectFit: block.objectFit,
    scale: block.scale,
    text: block.text,
    backgroundColor: block.backgroundColor,
    backgroundColorTransparent: block.backgroundColorTransparent,
    textColor: block.textColor,
    fontSize: block.fontSize,
  };
}

/** Renders a single track layer (video, image, or text). */
function TrackLayer({
  block,
  videoTime,
  playing,
  projectId,
  getPendingFile,
}: {
  block: TimelineNode & { start: number };
  videoTime: number;
  playing: boolean;
  projectId: string;
  getPendingFile: (p: string) => File | undefined;
}) {
  const { t } = useTranslation();
  const resolved = resolveBlock(block);
  const { mediaPath, crop, objectFit = 'contain', scale = 1, text, backgroundColor, backgroundColorTransparent, textColor, fontSize } = resolved;
  const mediaUrl = useMediaUrl(projectId, mediaPath, getPendingFile);
  const fileNameForType = mediaPath?.startsWith('pending:')
    ? getPendingFile(mediaPath)?.name
    : mediaPath?.replace(/^media\//, '').split('/').pop();
  const mediaType = mediaPath ? getMediaType(mediaPath, fileNameForType) : 'other';
  const isTextBlock = block.type === 'text' || mediaPath?.startsWith('text:');
  const videoRef = useRef<HTMLVideoElement>(null);
  const offsetInBlock = videoTime - block.start;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaType !== 'video' || !mediaUrl) return;
    const clipMax = block.duration;
    const videoMax = Number.isFinite(video.duration) ? video.duration : clipMax;
    const targetTime = Math.max(0, Math.min(offsetInBlock, clipMax, videoMax));
    const threshold = playing ? 0.05 : 0;
    if (Math.abs(video.currentTime - targetTime) > threshold) {
      video.currentTime = targetTime;
    }
  }, [mediaUrl, mediaType, offsetInBlock, block.duration, playing]);

  const clipStyle =
    crop && (crop.top || crop.right || crop.bottom || crop.left)
      ? { clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)` }
      : undefined;
  /** Base track (0) and track 1+ should fill the entire frame; use cover for video/image. */
  const effectiveObjectFit = (mediaType === 'video' || mediaType === 'image')
    ? 'cover' as const
    : objectFit;
  const mediaStyle = {
    ...clipStyle,
    objectFit: effectiveObjectFit,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: 'center center',
  };

  if (isTextBlock) {
    const displayText = text ?? '';
    const fgColor = textColor ?? '#000000';
    const isTransparent = (block.type === 'text' ? block.backgroundColorTransparent : backgroundColorTransparent) === true;
    return (
      <div className="absolute inset-0 w-full h-full flex items-center justify-center p-8 pointer-events-none">
        <div
          className="inline-block font-medium text-center break-words"
          style={{
            width: 'fit-content',
            height: 'fit-content',
            ...(isTransparent ? { backgroundColor: 'transparent', background: 'none' } : { backgroundColor: backgroundColor ?? '#ffffff' }),
            color: fgColor,
            fontSize: fontSize ? `${fontSize}px` : undefined,
          }}
        >
          {displayText || t('editor.preview.textPlaceholder', 'Text')}
        </div>
      </div>
    );
  }

  if (mediaPath && (mediaType === 'video' || mediaType === 'image')) {
    if (mediaType === 'video' && mediaUrl) {
      return (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={mediaUrl}
            className="w-full h-full min-w-0 min-h-0"
            style={mediaStyle}
            muted
            playsInline
          />
        </div>
      );
    }
    if (mediaType === 'image' && mediaUrl) {
      return (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
          <img
            src={mediaUrl}
            alt=""
            className="w-full h-full min-w-0 min-h-0"
            style={mediaStyle}
          />
        </div>
      );
    }
    if (mediaUrl === null) {
      return (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-800 dark:bg-[#1a1a1a]">
          <span className="text-slate-400 dark:text-white/40 text-sm">{t('editor.preview.loading', 'Loading…')}</span>
        </div>
      );
    }
  }

  if (!mediaPath) {
    return (
      <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-700 dark:bg-[#2a2a2a]">
        <span className="text-slate-400 dark:text-white/40 text-sm">{t('editor.preview.noMedia', 'No media')}</span>
      </div>
    );
  }

  return null;
}

function EmptyFillLayer({ emptyFill }: { emptyFill: { type: 'color'; value: string } | { type: 'image'; url: string } }) {
  if (emptyFill.type === 'color') {
    return (
      <div
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: emptyFill.value }}
      />
    );
  }
  if (emptyFill.type === 'image' && emptyFill.url) {
    return (
      <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
        <img src={emptyFill.url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return <div className="absolute inset-0 w-full h-full bg-black" />;
}

function PreviewContent({
  projectId,
  items,
  videoTime,
  playing,
  emptyFill,
  getPendingFile,
}: {
  projectId: string;
  items: TimelineNode[];
  videoTime: number;
  playing: boolean;
  emptyFill: { type: 'color'; value: string } | { type: 'image'; url: string };
  getPendingFile: (p: string) => File | undefined;
}) {
  const blocks = items.map((node, idx) => ({
    ...node,
    start: node.startTime ?? (idx === 0 ? 0 : items.slice(0, idx).reduce((s, n) => s + n.duration, 0)),
  }));
  /** All blocks active at current time. Sort: trackIndex (0=bottom), then stackIndex (1=bottom, higher=on top), then stable by id. */
  const activeLayers = blocks
    .filter((b) => videoTime >= b.start && videoTime < b.start + b.duration)
    .sort((a, b) => {
      const trackA = a.trackIndex ?? 0;
      const trackB = b.trackIndex ?? 0;
      if (trackA !== trackB) return trackA - trackB;
      const stackA = a.stackIndex ?? 1;
      const stackB = b.stackIndex ?? 1;
      if (stackA !== stackB) return stackA - stackB;
      return a.id.localeCompare(b.id);
    });

  return (
    <>
      <EmptyFillLayer emptyFill={emptyFill} />
      {activeLayers.map((block) => (
        <TrackLayer
          key={block.id}
          block={block}
          videoTime={videoTime}
          playing={playing}
          projectId={projectId}
          getPendingFile={getPendingFile}
        />
      ))}
    </>
  );
}

export function PreviewPanel() {
  const { t } = useTranslation();
  const { project, addTimelineNode, getPendingFile } = useProjectStore();
  const { videoTime, playing, emptyFill } = usePlaybackStore();
  const clearTimelineSelection = useTimelineSelectionStore((s) => s.clearSelection);
  const setSelectedMediaPath = useMediaSelectionStore((s) => s.setSelectedMediaPath);
  const [dragOver, setDragOver] = useState(false);

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
    const node = getDragNodeData(e.dataTransfer);
    if (node) addTimelineNode(node);
  }

  function handleClickPreview() {
    // Clicking the preview should show the global video/project configuration:
    // clear any timeline and media selection so the right sidebar falls back to VideoConfigurationPanel.
    clearTimelineSelection();
    setSelectedMediaPath(null);
  }

  return (
    <section className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-[#252525]">
      <div className="flex-1 min-h-0 flex flex-col p-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClickPreview}
          className={`relative flex-1 min-h-[200px] aspect-video rounded-lg border overflow-hidden transition-colors ${
            dragOver ? 'border-emerald-500/50 bg-emerald-100 dark:bg-emerald-500/5' : 'border-slate-300 dark:border-white/5'
          }`}
        >
          {project ? (
            <PreviewContent
              projectId={project.id}
              items={(project.root && getActiveTimeline(project.root)?.items) ?? []}
              videoTime={videoTime}
              playing={playing}
              emptyFill={emptyFill}
              getPendingFile={getPendingFile}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-200 dark:bg-[#1e1e1e]">
              <span className="text-slate-500 dark:text-white/50">{t('editor.noProject')}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
