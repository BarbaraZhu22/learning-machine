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
    <label className="flex items-center gap-2 text-sm font-medium">
      <span>{t('language')}</span>
      <select
        className="rounded-md border border-surface-300 bg-surface-100 px-2 py-1 text-sm outline-none transition focus:border-primary-400 dark:border-surface-700 dark:bg-surface-900"
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

