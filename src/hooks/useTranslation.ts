'use client';

import { useCallback } from 'react';
import { translations } from '@/data/languages';
import { useAppStore, selectLanguage } from '@/store/useAppStore';

export const useTranslation = () => {
  const language = useAppStore(selectLanguage);

  const t = useCallback(
    (key: string) => {
      const dictionary = translations[language] ?? translations.en;
      return dictionary[key] ?? translations.en[key] ?? key;
    },
    [language],
  );

  return { t, language };
};

