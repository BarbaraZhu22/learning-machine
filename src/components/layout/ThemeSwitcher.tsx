'use client';

import { ChangeEvent } from 'react';
import { ThemeMode } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore, selectTheme } from '@/store/useAppStore';

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export const ThemeSwitcher = () => {
  const { t } = useTranslation();
  const theme = useAppStore(selectTheme);
  const setTheme = useAppStore((state) => state.setTheme);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setTheme(event.target.value as ThemeMode);
  };

  return (
    <label className="flex items-center gap-2 rounded-full bg-[color:var(--glass-base)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700 shadow-sm backdrop-blur dark:bg-surface-800/70 dark:text-primary-200">
      <span>{t('theme')}</span>
      <select
        className="rounded-full border border-primary-200 bg-transparent px-2 py-1 text-xs font-medium text-primary-700 outline-none transition focus:border-primary-400 dark:border-surface-600 dark:text-primary-200"
        value={theme}
        onChange={handleChange}
      >
        {themeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

