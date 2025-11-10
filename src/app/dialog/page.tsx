'use client';

import { DialogSimulator } from '@/components/dialog/DialogSimulator';
import { useTranslation } from '@/hooks/useTranslation';

export default function DialogPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 rounded-xl border border-surface-200 bg-white p-6 shadow-sm dark:border-surface-700 dark:bg-surface-900">
      <h1 className="text-3xl font-semibold">{t('simulateDialog')}</h1>
      <p className="text-sm text-muted-foreground">
        Stage conversations without AI. Configure characters, keep situational notes, and export transcripts to your notes collection.
      </p>
      <DialogSimulator />
    </div>
  );
}

