'use client';

import { ChangeEvent } from 'react';
import { colorThemes } from '@/data/colorThemes';
import { useAppStore, selectColorTheme } from '@/store/useAppStore';
import { ColorThemeKey } from '@/types';

export const ColorThemeSwitcher = () => {
  const colorTheme = useAppStore(selectColorTheme);
  const setColorTheme = useAppStore((state) => state.setColorTheme);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setColorTheme(event.target.value as ColorThemeKey);
  };

  return (
    <label className="flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700 shadow-sm backdrop-blur dark:bg-surface-800/70 dark:text-primary-200">
      <span>Colors</span>
      <select
        className="rounded-full border border-primary-200 bg-transparent px-2 py-1 text-xs font-medium text-primary-700 outline-none transition focus:border-primary-400 dark:border-surface-600 dark:text-primary-200"
        value={colorTheme}
        onChange={handleChange}
      >
        {colorThemes.map((theme) => (
          <option key={theme.key} value={theme.key}>
            {theme.label}
          </option>
        ))}
      </select>
    </label>
  );
};

