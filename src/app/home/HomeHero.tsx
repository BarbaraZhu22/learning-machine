"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { learningLanguages } from "@/data/learningLanguages";
import { selectLearningLanguage, useAppStore } from "@/store/useAppStore";
import styles from "./HomeHero.module.css";

export default function HomeHero() {
  const { t } = useTranslation();
  const learningLanguage = useAppStore(selectLearningLanguage);
  const setLearningLanguage = useAppStore((state) => state.setLearningLanguage);

  const languageLabels = useMemo(
    () => learningLanguages.map((option) => option.label),
    []
  );
  const marqueeLanguages = useMemo(
    () => [...languageLabels, ...languageLabels],
    [languageLabels]
  );

  const [displayedText, setDisplayedText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (languageLabels.length === 0) {
      return;
    }

    const currentPhrase =
      languageLabels[phraseIndex % languageLabels.length] ?? "";

    let timeoutId: number;

    if (!isDeleting && displayedText === currentPhrase) {
      timeoutId = window.setTimeout(() => setIsDeleting(true), 1200);
    } else if (isDeleting && displayedText === "") {
      timeoutId = window.setTimeout(() => {
        setIsDeleting(false);
        setPhraseIndex((index) => index + 1);
      }, 260);
    } else {
      const nextLength = isDeleting
        ? displayedText.length - 1
        : displayedText.length + 1;

      timeoutId = window.setTimeout(() => {
        setDisplayedText(currentPhrase.slice(0, nextLength));
      }, isDeleting ? 45 : 95);
    }

    return () => window.clearTimeout(timeoutId);
  }, [displayedText, isDeleting, phraseIndex, languageLabels]);

  const activePhrase =
    languageLabels.length > 0
      ? languageLabels[phraseIndex % languageLabels.length]
      : "";
  const typedDisplay = displayedText || activePhrase;

  return (
    <section className="app-card app-card-mask p-10">
      <div className="max-w-2xl space-y-5">
        <h1 className="bg-gradient-to-r from-surface-700 via-accent-500 to-primary-700 bg-clip-text text-4xl font-bold leading-tight text-transparent dark:from-primary-200 dark:via-accent-200 dark:to-primary-400">
          {t("appTitle")}
        </h1>
      </div>

      <div
        className={`mt-10 rounded-2xl border border-accent-200/60 bg-[color:var(--glass-base)] p-6 shadow-md shadow-accent-100/30 backdrop-blur dark:border-accent-200/40 dark:bg-surface-900/80 ${styles.heroShell}`}
      >
        <div className={styles.selectorColumn}>
          <label className="flex flex-col gap-3 text-sm font-medium text-primary-800 dark:text-primary-100">
            <span className="text-xs font-normal uppercase tracking-[0.18em] text-muted-foreground">
              {t("chooseLearningLanguage")}
            </span>
            <select
              aria-label={t("chooseLearningLanguage")}
              className="w-full rounded-md border border-primary-200 bg-surface-50 px-3 py-2 text-sm text-primary-800 shadow-inner transition focus:border-accent-200 focus:ring-2 focus:ring-accent-200/50 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-100"
              value={learningLanguage}
              onChange={(event) =>
                setLearningLanguage(
                  event.target.value as typeof learningLanguage
                )
              }
            >
              {learningLanguages.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {languageLabels.length > 0 && (
          <div className={styles.marqueeColumn}>
            <div className={styles.marqueeCopy}>
              <div className={styles.typewriterWrapper} aria-live="polite">
                {t("languageShowcaseTitle")}{" "}
                <span className={styles.typewriter}>{typedDisplay}</span>
              </div>
            </div>

            <div className={styles.marqueeViewport}>
              <span
                aria-hidden="true"
                className={`${styles.marqueeShade} ${styles.marqueeShadeLeft}`}
              />
              <span
                aria-hidden="true"
                className={`${styles.marqueeShade} ${styles.marqueeShadeRight}`}
              />
              <div className={styles.marqueeTrack}>
                {marqueeLanguages.map((label, index) => (
                  <span key={`${label}-${index}`} className={styles.marqueePill}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

