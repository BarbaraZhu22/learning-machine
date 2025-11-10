'use client';

import { VocabularyDashboard } from '@/components/vocabulary/VocabularyDashboard';
import { LinkNetwork } from '@/components/network/LinkNetwork';
import { useTranslation } from '@/hooks/useTranslation';

export default function ExtensionPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-700 dark:bg-surface-900">
        <h1 className="text-3xl font-semibold">{t('superExtension')}</h1>
        <p className="text-sm text-muted-foreground">
          Add vocabulary, monitor your total count, and spin an interactive link network. All powered locally through IndexedDB and Zustand.
        </p>
      </section>

      <section className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-700 dark:bg-surface-900">
        <VocabularyDashboard />
      </section>

      <section className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-700 dark:bg-surface-900">
        <LinkNetwork />
      </section>
    </div>
  );
}

