'use client';

import Link from 'next/link';
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { useTranslation } from '@/hooks/useTranslation';

const NAV_ITEMS = [
  { href: '/note', labelKey: 'notes' },
  { href: '/dialog', labelKey: 'simulateDialog' },
  { href: '/extension', labelKey: 'superExtension' },
];

export const SiteHeader = () => {
  const { t } = useTranslation();

  return (
    <header className="border-b border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="text-xl font-semibold">
            {t('appTitle')}
          </Link>
          <nav className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground md:mt-0 md:gap-6">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-primary-500">
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
};

