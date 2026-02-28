import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from './stores/themeStore';
import { useInitialProjectId } from './hooks/useInitialProjectId';
import { useMenuActions } from './hooks/useMenuActions';
import { EditorHeader, PreviewPanel, TimelinePanel } from './components';

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
      className="h-screen flex flex-col bg-slate-900 text-white"
      dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
    >
      <EditorHeader />
      <main className="flex-1 flex min-h-0">
        <PreviewPanel />
        <TimelinePanel />
      </main>
    </div>
  );
}
