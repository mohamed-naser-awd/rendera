import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../stores/projectStore';
import { useThemeStore } from '../stores/themeStore';

export function useMenuActions() {
  const { createProject } = useProjectStore();
  const { setTheme } = useThemeStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    const api = (window as { electronAPI?: unknown }).electronAPI as {
      onMenuNewProject?: (cb: () => void) => () => void;
      onMenuSetTheme?: (cb: (t: 'light' | 'dark') => void) => () => void;
      onMenuSetLanguage?: (cb: (lang: string) => void) => () => void;
    } | undefined;

    const unsubNew = api?.onMenuNewProject?.(createProject);
    const unsubTheme = api?.onMenuSetTheme?.(setTheme);
    const unsubLang = api?.onMenuSetLanguage?.((lang) => i18n.changeLanguage(lang));

    return () => {
      unsubNew?.();
      unsubTheme?.();
      unsubLang?.();
    };
  }, [createProject, setTheme, i18n]);
}
