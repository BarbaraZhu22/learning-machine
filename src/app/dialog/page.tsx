"use client";

import { useState, useEffect, useCallback } from "react";
import { AIChatDialog } from "@/app/layout/AIChatDialog/AIChatDialog";
import { Notice, CounterCard } from "@/components/common";
import { DialogDisplay } from "@/components/dialog/DialogDisplay";
import { DialogCard } from "@/components/dialog/DialogCard";
import { useTranslation } from "@/hooks/useTranslation";
import { selectLearningLanguageLabel, useAppStore } from "@/store/useAppStore";
import { indexedDbClient } from "@/lib/indexedDb";
import type { FlowState } from "@/lib/lm-ai/types";
import type { DialogRecord } from "@/types";

/**
 * Generate unique dialog ID: diagxxx-sessionxxx
 */
function generateDialogId(sessionId?: string): string {
  const diagPart = `diag${Date.now()}`;
  const sessionPart =
    sessionId || `session${Math.random().toString(36).slice(2, 9)}`;
  return `${diagPart}-${sessionPart}`;
}

/**
 * Extract dialog generation output and audio output from flow state
 */
function extractDialogData(flowState: FlowState): {
  dialogContent: DialogRecord["dialogContent"];
  voiceSuggestions?: DialogRecord["voiceSuggestions"];
} | null {
  // Find dialog-generation step
  const dialogGenStep = flowState.steps.find(
    (s) => s.nodeId === "dialog-generation"
  );

  if (!dialogGenStep?.result?.output) {
    return null;
  }

  const dialogContent = dialogGenStep.result
    .output as DialogRecord["dialogContent"];

  // Find dialog-audio step for voice suggestions
  const audioStep = flowState.steps.find((s) => s.nodeId === "dialog-audio");
  const audioOutput = audioStep?.result?.output;

  // Extract voice suggestions (Record<string, string>)
  let voiceSuggestions: DialogRecord["voiceSuggestions"] | undefined;

  if (audioOutput && audioOutput !== null) {
    voiceSuggestions = audioOutput as DialogRecord["voiceSuggestions"];
  }

  // Validate structure
  if (
    !dialogContent ||
    typeof dialogContent !== "object" ||
    !Array.isArray(dialogContent.characters) ||
    !Array.isArray(dialogContent.dialog)
  ) {
    return null;
  }

  return { dialogContent, voiceSuggestions };
}

export default function DialogPage() {
  const { t } = useTranslation();
  const learningLanguageLabel = useAppStore(selectLearningLanguageLabel);
  const learningLanguage = useAppStore((state) => state.learningLanguage);

  const [showNotice, setShowNotice] = useState(false);
  const [completedState, setCompletedState] = useState<FlowState | null>(null);
  const [showDialogDisplay, setShowDialogDisplay] = useState(false);
  const [selectedDialogRecord, setSelectedDialogRecord] =
    useState<DialogRecord | null>(null);
  const [dialogs, setDialogs] = useState<DialogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Load dialogs
  const loadDialogs = useCallback(async () => {
    try {
      setLoading(true);
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
  }, []);

  useEffect(() => {
    loadDialogs();
  }, [loadDialogs]);

  const handleWorkflowComplete = async (data: {
    action: string;
    success: boolean;
    state: FlowState;
  }) => {
    if (data.action === "simulate-dialog" && data.success) {
      setCompletedState(data.state);
      setShowNotice(true);
    }
  };

  const handleConfirmGenerate = async () => {
    setShowNotice(false);

    if (completedState) {
      // Extract dialog data
      const dialogData = extractDialogData(completedState);
      if (dialogData) {
        // Generate unique ID
        const dialogId = generateDialogId(completedState.sessionId);
        const now = new Date().toISOString();

        // Create dialog record
        const dialogRecord: DialogRecord = {
          id: dialogId,
          sessionId: completedState.sessionId,
          dialogContent: dialogData.dialogContent,
          voiceSuggestions: dialogData.voiceSuggestions,
          learningLanguage,
          createdAt: now,
          updatedAt: now,
        };

        // Save to IndexedDB
        try {
          await indexedDbClient.saveDialog(dialogRecord);
          // Reload dialogs list
          await loadDialogs();
          // Show the dialog
          setSelectedDialogRecord(dialogRecord);
          setShowDialogDisplay(true);
        } catch (error) {
          console.error("Failed to save dialog:", error);
          // Still show the dialog even if save fails
          setShowDialogDisplay(true);
        }
      } else {
        // Still show even if extraction fails
        setShowDialogDisplay(true);
      }
    }

    // Clear completed state after a delay
    setTimeout(() => {
      setCompletedState(null);
    }, 100);
  };

  const handleCancelGenerate = () => {
    setShowNotice(false);
    setCompletedState(null);
  };

  const handleSelectDialog = (dialog: DialogRecord) => {
    setSelectedDialogRecord(dialog);
    setShowDialogDisplay(true);
  };

  const handleCloseDialogDisplay = () => {
    setShowDialogDisplay(false);
    setSelectedDialogRecord(null);
    setCompletedState(null);
  };

  // Show full page overlay if displaying dialog
  if (showDialogDisplay && (selectedDialogRecord || completedState)) {
    return (
      <DialogDisplay
        flowState={completedState || undefined}
        dialogRecord={selectedDialogRecord || undefined}
        onClose={handleCloseDialogDisplay}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-6 rounded-xl border border-transparent bg-gradient-to-r from-primary-50 via-surface-50 to-primary-50 p-4 sm:p-6 shadow-lg shadow-primary-100/60 dark:border-surface-700 dark:bg-surface-900">
        <div className="flex gap-2 items-baseline justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold text-primary-700 dark:text-primary-200">
            {t("simulateDialog")}
          </h1>
          <span className="text-xs sm:text-sm text-primary-700/80 dark:text-primary-100/80">
            {t("learningLanguage")}:{" "}
            <strong className="font-semibold">{learningLanguageLabel}</strong>
          </span>
        </div>
        <AIChatDialog
          action="simulate-dialog"
          placeholder={t("dialogScenarioPlaceholder")}
          onComplete={handleWorkflowComplete}
        />
      </section>

      {/* Dialogs Section */}
      <section
        id="dialogs-section"
        className="space-y-4 rounded-xl border border-transparent bg-gradient-to-r from-primary-50 via-surface-50 to-primary-50 p-4 sm:p-6 shadow-lg shadow-primary-100/60 dark:border-surface-700 dark:bg-surface-900"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold text-primary-700 dark:text-primary-200">
            {t("allDialogs")}
          </h1>
          <CounterCard
            count={dialogs.length}
            label={t("dialogs")}
            onClick={() => {}}
            className="cursor-default hover:scale-100"
            scale={0.7}
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        ) : dialogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground text-center px-4">
              {t("noDialogs")}
            </p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto pr-2">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {dialogs.map((dialog) => (
                <DialogCard
                  key={dialog.id}
                  dialog={dialog}
                  onClick={() => handleSelectDialog(dialog)}
                  onDelete={async () => {
                    try {
                      await indexedDbClient.deleteDialog(dialog.id);
                      await loadDialogs();
                    } catch (error) {
                      console.error("Failed to delete dialog:", error);
                    }
                  }}
                  onRename={async (newName: string) => {
                    try {
                      const updated: DialogRecord = {
                        ...dialog,
                        name: newName,
                        updatedAt: new Date().toISOString(),
                      };
                      await indexedDbClient.saveDialog(updated);
                      await loadDialogs();
                    } catch (error) {
                      console.error("Failed to rename dialog:", error);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Notice Modal */}
      {showNotice && (
        <Notice
          title={t("generateDialog")}
          message={t("generateDialogMessage")}
          onConfirm={handleConfirmGenerate}
          onCancel={handleCancelGenerate}
          confirmLabel={t("saveAndView")}
        />
      )}
    </div>
  );
}
