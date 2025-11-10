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
    <label className="flex items-center gap-2 text-sm font-medium">
      <span>{t('theme')}</span>
      <select
        className="rounded-md border border-surface-300 bg-surface-100 px-2 py-1 text-sm outline-none transition focus:border-primary-400 dark:border-surface-700 dark:bg-surface-900"
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

