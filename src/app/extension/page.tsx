'use client';

import { VocabularyDashboard } from '@/components/vocabulary/VocabularyDashboard';
import { LinkNetwork } from '@/components/network/LinkNetwork';
import { useTranslation } from '@/hooks/useTranslation';

export default function ExtensionPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-transparent bg-gradient-to-r from-primary-50 via-surface-50 to-accent-50 p-6 shadow-lg shadow-primary-100/60 dark:border-surface-700 dark:bg-surface-900">
        <h1 className="text-3xl font-semibold text-primary-700 dark:text-primary-200">{t('superExtension')}</h1>
      </section>

      <section className="rounded-xl border border-transparent bg-white/90 p-6 shadow-lg shadow-primary-100/60 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        <VocabularyDashboard />
      </section>

      <section className="rounded-xl border border-transparent bg-white/90 p-6 shadow-lg shadow-primary-100/60 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        <LinkNetwork />
      </section>
    </div>
  );
}

