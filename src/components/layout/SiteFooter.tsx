"use client";

import { useTranslation } from "@/hooks/useTranslation";

export const SiteFooter = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-surface-200/50 bg-[color:var(--glass-base)] px-6 py-4 text-center text-sm text-muted-foreground shadow-lg shadow-accent-100/10 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--glass-accent)] dark:border-surface-700/60 dark:bg-surface-900/60 dark:text-primary-100/80">
      <span>
        © {currentYear} {t("footerOwner")}
      </span>
      <span className="mx-2 text-muted-foreground/60">|</span>
      <span>{t("footerRights")}</span>
    </footer>
  );
};

