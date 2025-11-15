"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface NoticeProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const Notice = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
}: NoticeProps) => {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the modal into view when it appears
    if (modalRef.current) {
      modalRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4">
      <div 
        ref={modalRef}
        className="mx-4 w-full max-w-md rounded-lg border border-surface-200/50 bg-[color:var(--glass-base)] p-6 shadow-lg shadow-primary-100/40 backdrop-blur dark:border-surface-700 dark:bg-surface-900 my-auto"
      >
        <h3 className="mb-4 text-lg font-semibold text-primary-700 dark:text-primary-200">
          {title}
        </h3>
        <p className="mb-6 text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-surface-300 bg-surface-50 px-4 py-2 text-sm font-medium text-surface-700 transition hover:bg-surface-100 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-200 dark:hover:bg-surface-700"
          >
            {cancelLabel || t("cancel") || "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-gradient-to-r from-primary-500 to-primary-700 px-4 py-2 text-sm font-semibold text-[color:var(--text-inverse)] shadow-md transition hover:brightness-105"
          >
            {confirmLabel || t("confirm") || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

