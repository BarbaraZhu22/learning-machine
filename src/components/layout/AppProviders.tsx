'use client';

import { PropsWithChildren, useEffect } from 'react';
import { useAppStore, selectTheme } from '@/store/useAppStore';
import { useIndexedDbSync } from '@/hooks/useIndexedDbSync';

const applyTheme = (mode: string) => {
  const root = document.documentElement;
  root.dataset.theme = mode;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const AppProviders = ({ children }: PropsWithChildren ) => {
  const theme = useAppStore(selectTheme);
  useIndexedDbSync();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const resolveTheme = () => {
      if (theme === 'system') {
        applyTheme(media.matches ? 'dark' : 'light');
      } else {
        applyTheme(theme);
      }
    };

    resolveTheme();

    if (theme === 'system') {
      const listener = (event: MediaQueryListEvent) => applyTheme(event.matches ? 'dark' : 'light');
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme]);

  return <>{children}</>;
};

