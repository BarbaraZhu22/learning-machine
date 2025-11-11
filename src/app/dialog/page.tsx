'use client';

import { DialogSimulator } from '@/components/dialog/DialogSimulator';
import { useTranslation } from '@/hooks/useTranslation';

export default function DialogPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 rounded-xl border border-transparent bg-gradient-to-r from-primary-50 via-surface-50 to-accent-50 p-6 shadow-lg shadow-primary-100/60 dark:border-surface-700 dark:bg-surface-900">
      <h1 className="text-3xl font-semibold text-primary-700 dark:text-primary-200">{t('simulateDialog')}</h1>
      <DialogSimulator />
    </div>
  );
}

