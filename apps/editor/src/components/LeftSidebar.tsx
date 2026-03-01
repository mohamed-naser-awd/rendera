import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../stores/projectStore';
import type { MediaItem } from '../stores/projectStore';
import { usePlaybackStore } from '../stores/playbackStore';
import { useMediaSelectionStore } from '../stores/mediaSelectionStore';
import { useTimelineSelectionStore } from '../stores/timelineSelectionStore';
import { getApiBaseUrl } from '../../../../shared/getApiUrl';
import { setDragMediaData } from './NodePalette';

const TAB_IDS = ['media', 'annotations', 'transitions', 'behaviors', 'animations', 'effects'] as const;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 420;
const SIDEBAR_DEFAULT = 256;
const SIDEBAR_COLLAPSED_WIDTH = 40;

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv)$/i;

function getMediaType(path: string): 'image' | 'video' | 'text' | 'other' {
  if (path.startsWith('text:')) return 'text';
  if (IMAGE_EXT.test(path) || path.toLowerCase().endsWith('.gif')) return 'image';
  if (VIDEO_EXT.test(path)) return 'video';
  return 'other';
}

function MediaThumbnail({
  projectId,
  path,
  objectUrl,
  fileNameForType,
}: {
  projectId: string;
  path: string;
  objectUrl?: string | null;
  fileNameForType?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const filename = path.replace(/^media\//, '');
  const pathForType = fileNameForType ?? filename;

  const isImage = IMAGE_EXT.test(pathForType);
  const isVideo = VIDEO_EXT.test(pathForType);
  const isGif = pathForType.toLowerCase().endsWith('.gif');

  const displaySrc = path.startsWith('pending:') ? objectUrl : src;
  const isText = path.startsWith('text:');

  useEffect(() => {
    if (path.startsWith('pending:') || isText) return;
    getApiBaseUrl().then((base) => setSrc(`${base}/api/projects/${projectId}/media/${filename}`));
  }, [projectId, filename, path]);

  if (isText) {
    return (
      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded bg-slate-300 dark:bg-[#404040] text-slate-600 dark:text-white/70">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </div>
    );
  }
  if (!isImage && !isVideo && !isGif) {
    return (
      <div className="w-14 h-14 flex items-center justify-center rounded bg-slate-300 dark:bg-[#404040] text-slate-500 dark:text-white/50">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  if (isImage || isGif) {
    return (
      <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-slate-200 dark:bg-[#383838]">
        {displaySrc && <img src={displaySrc} alt="" className="w-full h-full object-cover" />}
      </div>
    );
  }
  if (isVideo) {
    return (
      <div className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-slate-200 dark:bg-[#383838] relative">
        {displaySrc && (
          <video src={displaySrc} className="w-full h-full object-cover" muted preload="metadata" />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function MediaItemWithPreview({
  projectId,
  path,
  getPendingFile,
}: {
  projectId: string;
  path: string;
  getPendingFile: (p: string) => File | undefined;
}) {
  const pendingFile = path.startsWith('pending:') ? getPendingFile(path) : undefined;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFile) return;
    const url = URL.createObjectURL(pendingFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  return (
    <MediaThumbnail
      projectId={projectId}
      path={path}
      objectUrl={objectUrl}
      fileNameForType={pendingFile?.name}
    />
  );
}

export function LeftSidebar() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>('media');
  const { project, addMedia, addTextMedia, addTimelineNode, getPendingFile } = useProjectStore();
  const { videoTime } = usePlaybackStore();
  const [dragOver, setDragOver] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const { selectedMediaPath, setSelectedMediaPath } = useMediaSelectionStore();
  const { clearSelection } = useTimelineSelectionStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  const media: MediaItem[] = Array.isArray(project?.root?.media) ? project.root.media : [];

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    function cleanup() {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onPointerUp);
      document.removeEventListener('visibilitychange', onPointerUp);
    }
    function onPointerMove(ev: PointerEvent) {
      const delta = ev.clientX - resizeStartX.current;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, resizeStartWidth.current + delta)));
    }
    function onPointerUp() {
      cleanup();
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('blur', onPointerUp);
    document.addEventListener('visibilitychange', onPointerUp);
  }, [sidebarWidth]);

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
    function closeAddMenu(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    if (addMenuOpen) {
      window.addEventListener('click', closeAddMenu);
      return () => window.removeEventListener('click', closeAddMenu);
    }
  }, [addMenuOpen]);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length && project) {
        for (let i = 0; i < files.length; i++) addMedia(files[i]);
      }
      e.target.value = '';
    },
    [project, addMedia]
  );
  const handleVideoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length && project) {
        for (let i = 0; i < files.length; i++) addMedia(files[i]);
      }
      e.target.value = '';
    },
    [project, addMedia]
  );

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
    const files = e.dataTransfer.files;
    if (files?.length && project) {
      for (let i = 0; i < files.length; i++) {
        addMedia(files[i]);
      }
    }
  }

  const tabLabels: Record<(typeof TAB_IDS)[number], string> = {
    media: t('editor.tabs.media', 'Media'),
    annotations: t('editor.tabs.annotations', 'Annotations'),
    transitions: t('editor.tabs.transitions', 'Transitions'),
    behaviors: t('editor.tabs.behaviors', 'Behaviors'),
    animations: t('editor.tabs.animations', 'Animations'),
    effects: t('editor.tabs.effects', 'Effects'),
  };

  return (
    <>
    <aside
      className="flex-shrink-0 flex border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d] relative transition-[width] duration-200"
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth }}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-full flex flex-col items-center justify-center py-4 text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/5"
          aria-label={t('editor.sidebar.expandSidebar', 'Expand sidebar')}
          title={t('editor.sidebar.expandSidebar', 'Expand sidebar')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <>
      <nav className="w-10 flex flex-col border-r border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#252525] py-2">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-2 py-2.5 text-xs font-medium flex items-center justify-center transition-colors ${
              activeTab === id
                ? 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#2d2d2d] border-l-2 border-l-emerald-500 -ml-px'
                : 'text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white/80'
            }`}
            title={tabLabels[id]}
          >
            {id === 'media' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
              </svg>
            )}
            {id === 'annotations' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            )}
            {id === 'transitions' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
            {id === 'behaviors' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {id === 'animations' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            )}
            {id === 'effects' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            )}
          </button>
        ))}
      </nav>
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-slate-200 dark:border-white/10 flex-shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label={t('editor.sidebar.collapseSidebar', 'Collapse sidebar')}
            title={t('editor.sidebar.collapseSidebar', 'Collapse sidebar')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-medium text-slate-700 dark:text-white/80 flex-1 min-w-0 truncate">
            {tabLabels[activeTab]}
          </h2>
          {activeTab === 'media' && (
            <div className="relative flex-shrink-0" ref={addMenuRef}>
              <button
                type="button"
                onClick={() => setAddMenuOpen((o) => !o)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10"
                aria-label={t('editor.media.add', 'Add media')}
                title={t('editor.media.add', 'Add media')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8v8H4V4h8" />
                </svg>
              </button>
              {addMenuOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d]">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
                    onClick={() => { imageInputRef.current?.click(); setAddMenuOpen(false); }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    </svg>
                    {t('editor.media.image', 'Image')}
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
                    onClick={() => { videoInputRef.current?.click(); setAddMenuOpen(false); }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    {t('editor.media.video', 'Video')}
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
                    onClick={() => {
                      const path = addTextMedia();
                      if (path) {
                        addTimelineNode(
                          {
                            type: 'text',
                            duration: 5,
                            label: t('editor.media.text', 'Text'),
                            mediaPath: path,
                            text: t('editor.media.text', 'Text'),
                            backgroundColor: '#ffffff',
                            textColor: '#000000',
                          },
                          { startTime: videoTime, trackIndex: 0 }
                        );
                      }
                      setAddMenuOpen(false);
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                    {t('editor.media.text', 'Text')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={handleVideoSelect}
        />
        <div
          className={`flex-1 min-h-0 overflow-auto p-3 transition-colors ${
            activeTab === 'media' && dragOver ? 'rounded-lg border-2 border-dashed border-emerald-500/50 bg-emerald-500/5' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {activeTab === 'media' ? (
            <div className="flex flex-wrap gap-2 content-start min-h-[120px]">
              {media.length === 0 && !dragOver ? (
                <p className="text-slate-500 dark:text-white/50 text-sm py-2">Drop images or files here</p>
              ) : (
                media.map((item, idx) => {
                  const isActive = selectedMediaPath === item.path;
                  const isTextItem = item.path.startsWith('text:');
                  const rawLabel = isTextItem
                    ? (item.defaults?.text?.trim() || t('editor.media.text', 'Text'))
                    : item.path.startsWith('pending:')
                      ? getPendingFile(item.path)?.name ?? item.path
                      : item.path.replace(/^media\//, '');
                  const label = isTextItem && rawLabel.length > 20 ? rawLabel.slice(0, 20) + '…' : rawLabel;
                  const mediaType = getMediaType(item.path);
                  return (
                    <div
                      key={item.path + idx}
                      draggable
                      onDragStart={(e) => {
                        setDragMediaData(e.dataTransfer, {
                          path: item.path,
                          type: mediaType,
                          label,
                        });
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => {
                        clearSelection();
                        setSelectedMediaPath(item.path);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, path: item.path });
                      }}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors select-none ${
                        isActive
                          ? 'bg-emerald-500/20 dark:bg-emerald-500/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                          : 'bg-slate-200 dark:bg-[#383838] border-slate-300 dark:border-white/5 hover:bg-slate-300 dark:hover:bg-[#424242]'
                      }`}
                    >
                      <MediaItemWithPreview
                        projectId={project!.id}
                        path={item.path}
                        getPendingFile={getPendingFile}
                      />
                      <span className="text-slate-800 dark:text-white/90 text-xs truncate max-w-[120px]" title={isTextItem ? (item.defaults?.text ?? item.path) : item.path}>
                        {label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-white/50 text-sm py-4">{tabLabels[activeTab]} — coming soon</p>
          )}
        </div>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={handleResizeStart}
        className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize group flex justify-center"
        style={{ marginRight: -3 }}
      >
        <div className="w-0.5 h-12 rounded-full bg-slate-300 dark:bg-white/20 group-hover:bg-emerald-500/60 group-active:bg-emerald-500 transition-colors" />
      </div>
        </>
      )}
    </aside>
    {contextMenu && (
      <div
        className="fixed z-50 min-w-[160px] py-1 rounded-lg shadow-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
          onClick={() => { setContextMenu(null); /* TODO: open crop */ }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
          </svg>
          {t('editor.media.crop', 'Crop')}
        </button>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
          onClick={() => { setContextMenu(null); /* TODO: open color */ }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          {t('editor.media.changeColor', 'Change color')}
        </button>
        <button
          type="button"
          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-white/90 hover:bg-slate-100 dark:hover:bg-[#383838] flex items-center gap-2"
          onClick={() => { setContextMenu(null); /* TODO: open properties */ }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t('editor.media.properties', 'Properties')}
        </button>
      </div>
    )}
    </>
  );
}
