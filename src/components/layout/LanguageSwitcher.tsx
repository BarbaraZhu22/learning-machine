'use client';

import { ChangeEvent } from 'react';
import { supportedLanguages } from '@/data/languages';
import { useAppStore, selectLanguage } from '@/store/useAppStore';
import { LanguageCode } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

export const LanguageSwitcher = () => {
  const { t } = useTranslation();
  const language = useAppStore(selectLanguage);
  const setLanguage = useAppStore((state) => state.setLanguage);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLanguage(event.target.value as LanguageCode);
  };

  return (
  <label className="flex items-center gap-2 rounded-full bg-[color:var(--glass-base)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700 shadow-sm backdrop-blur dark:bg-surface-800/70 dark:text-primary-200">
      <span>{t('language')}</span>
      <select
        className="rounded-full border border-primary-200 bg-transparent px-2 py-1 text-xs font-medium text-primary-700 outline-none transition focus:border-primary-400 dark:border-surface-600 dark:text-primary-200"
        value={language}
        onChange={handleChange}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
};

