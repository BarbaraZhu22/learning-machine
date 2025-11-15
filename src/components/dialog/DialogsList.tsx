"use client";

import { useEffect, useState } from "react";
import { DialogCard } from "./DialogCard";
import { useTranslation } from "@/hooks/useTranslation";
import { indexedDbClient } from "@/lib/indexedDb";
import type { DialogRecord } from "@/types";

interface DialogsListProps {
  onSelectDialog: (dialog: DialogRecord) => void;
  onClose: () => void;
}

export const DialogsList = ({ onSelectDialog, onClose }: DialogsListProps) => {
  const { t } = useTranslation();
  const [dialogs, setDialogs] = useState<DialogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDialogs = async () => {
      try {
        const allDialogs = await indexedDbClient.getAllDialogs();
        // Sort by createdAt descending (newest first)
        const sorted = allDialogs.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setDialogs(sorted);
      } catch (error) {
        console.error("Failed to load dialogs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDialogs();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
      <div className="relative h-full w-full max-w-4xl rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200/50 bg-[color:var(--glass-base)] px-4 py-3 sm:px-6 sm:py-4 backdrop-blur dark:border-surface-700">
          <h2 className="text-lg sm:text-xl font-semibold text-primary-700 dark:text-primary-200">
            {t("allDialogs") || "All Dialogs"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium text-muted-foreground transition hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            {t("close") || "Close"}
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-80px)] overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                {t("loading") || "Loading..."}
              </p>
            </div>
          ) : dialogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground text-center px-4">
                {t("noDialogs") || "No dialogs yet. Generate one to get started!"}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {dialogs.map((dialog) => (
                <DialogCard
                  key={dialog.id}
                  dialog={dialog}
                  onClick={() => onSelectDialog(dialog)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

