"use client";

import Link from "next/link";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ColorThemeSwitcher } from "@/components/layout/ColorThemeSwitcher";
import { AISettings } from "@/components/layout/AISettings";
import { useTranslation } from "@/hooks/useTranslation";

const NAV_ITEMS = [
  { href: "/", labelKey: "home" },
  { href: "/note", labelKey: "notes" },
  { href: "/dialog", labelKey: "simulateDialog" },
  { href: "/extension", labelKey: "superExtension" },
];

export const SiteHeader = () => {
  const { t } = useTranslation();

  return (
    <header className="glass-header relative z-20">
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-200 to-transparent opacity-80" />
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-2 tracking-wider bg-gradient-to-r from-primary-500 via-accent-500 to-primary-700 bg-clip-text text-2xl font-semibold text-transparent transition hover:from-primary-400 hover:to-primary-600 dark:from-primary-200 dark:via-accent-200 dark:to-primary-400"
          >
            {t("appTitle")}
          </Link>
          <nav className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground md:mt-0 md:gap-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-surface-200/60 bg-[color:var(--glass-base)] px-3 py-1 font-medium text-primary-700 shadow-sm transition hover:-translate-y-0.5 hover:border-surface-300/60 hover:bg-[color:var(--glass-accent)] hover:text-primary-900 dark:border-surface-700/60 dark:bg-surface-800/65 dark:text-primary-200 dark:hover:border-surface-600/60 dark:hover:bg-surface-800/80 dark:hover:text-primary-100"
              >
                {t(item.labelKey)}
              </Link>
            ))}
            <AISettings />
          </nav>
        </div>
        <div className="group absolute right-3 top-4 z-30 flex scale-65  origin-top-right flex-row-reverse items-center justify-end gap-1 rounded-full border border-surface-200/60 bg-[color:var(--glass-base)] px-2 py-1 text-[0.68rem] shadow-sm backdrop-blur-md transition-all duration-200 dark:border-surface-700/60 dark:bg-surface-900/75 md:static md:ml-auto md:scale-100 md:flex-row md:gap-2 md:px-3 md:py-2 md:text-sm">
          <LanguageSwitcher />
          <div className="hidden flex-row-reverse items-center justify-end gap-1 group-focus-within:flex group-hover:flex md:flex md:flex-row md:justify-end md:gap-2">
            <ThemeSwitcher />
            <ColorThemeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
};
