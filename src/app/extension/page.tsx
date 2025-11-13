"use client";

import { VocabularyDashboard } from "@/components/vocabulary/VocabularyDashboard";
import { LinkNetwork } from "@/components/network/LinkNetwork";
import { useTranslation } from "@/hooks/useTranslation";
import { selectLearningLanguageLabel, useAppStore } from "@/store/useAppStore";

export default function ExtensionPage() {
  const { t } = useTranslation();
  const learningLanguageLabel = useAppStore(selectLearningLanguageLabel);

  return (
    <div className="space-y-6">
      <section className="space-y-6 rounded-xl border border-transparent bg-gradient-to-r from-primary-50 via-surface-50 to-primary-50 p-6 shadow-lg shadow-primary-100/60 dark:border-surface-700 dark:bg-surface-900">
        <div className="flex flex-row gap-2 items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-primary-700 dark:text-primary-200">
            {t("superExtension")}
          </h1>
          <span className="text-sm text-primary-700/80 dark:text-primary-100/80">
            {t("learningLanguage")}:{" "}
            <strong className="font-semibold">{learningLanguageLabel}</strong>
          </span>
        </div>
        <VocabularyDashboard />
        <LinkNetwork />
      </section>
    </div>
  );
}
