import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'dark' ? 'light' : 'dark';
          document.documentElement.classList.toggle('dark', next === 'dark');
          return { theme: next };
        }),
    }),
    {
      name: 'rendera-theme',
      version: 1,
      partialize: (s) => ({ theme: s.theme }),
      migrate: (persistedState: unknown) => {
        if (!persistedState || typeof persistedState !== 'object') return { theme: 'dark' as Theme };
        const s = persistedState as Record<string, unknown>;
        // Handle nested format from manual localStorage or older persist
        const state = (s.state as Record<string, unknown>) ?? s;
        const theme = state.theme === 'light' || state.theme === 'dark' ? state.theme : 'dark';
        return { theme };
      },
    }
  )
);
