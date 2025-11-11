'use client';

import { PropsWithChildren, useEffect } from 'react';
import { useAppStore, selectTheme, selectColorTheme } from '@/store/useAppStore';
import { useIndexedDbSync } from '@/hooks/useIndexedDbSync';
import { colorThemeMap, defaultColorTheme } from '@/data/colorThemes';

const applyTheme = (mode: string) => {
  const root = document.documentElement;
  root.dataset.theme = mode;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

const setPalette = (mode: 'light' | 'dark', colorThemeKey: string) => {
  const palette = (colorThemeMap[colorThemeKey as keyof typeof colorThemeMap] ??
    colorThemeMap[defaultColorTheme])[mode];
  const root = document.documentElement;
  Object.entries(palette).forEach(([token, value]) => {
    root.style.setProperty(`--${token}`, value);
  });
};

export const AppProviders = ({ children }: PropsWithChildren) => {
  const theme = useAppStore(selectTheme);
  const colorTheme = useAppStore(selectColorTheme);
  useIndexedDbSync();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyMode = (mode: 'light' | 'dark') => {
      applyTheme(mode);
      setPalette(mode, colorTheme);
    };

    const resolveTheme = () => {
      if (theme === 'system') {
        applyMode(media.matches ? 'dark' : 'light');
      } else {
        applyMode(theme);
      }
    };

    resolveTheme();

    if (theme === 'system') {
      const listener = (event: MediaQueryListEvent) => applyMode(event.matches ? 'dark' : 'light');
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme, colorTheme]);

  return <>{children}</>;
};

