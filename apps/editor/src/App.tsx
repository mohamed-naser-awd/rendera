import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/stores/themeStore';
import { useInitialProjectId } from '@/hooks/useInitialProjectId';
import { useMenuActions } from '@/hooks/useMenuActions';
import { EditorHeader, LeftSidebar, RightSidebar, PlaybackControls, PreviewPanel, TimelinePanel } from '@/components';

export default function App() {
  const { i18n } = useTranslation();
  const { theme } = useThemeStore();

  useInitialProjectId();
  useMenuActions();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div
      className="h-screen flex flex-col bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white"
      dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
    >
      <EditorHeader />
      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <LeftSidebar />
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            <PreviewPanel />
            <PlaybackControls />
          </div>
          <RightSidebar />
        </div>
        <div className="flex-shrink-0">
          <TimelinePanel />
        </div>
      </main>
    </div>
  );
}
