"use client";

import { useState, useEffect, useCallback } from "react";
import { AIChatDialog } from "@/app/layout/AIChatDialog/AIChatDialog";
import { Notice } from "@/components/common";
import { CounterCard } from "@/components/common/CounterCard";
import { useTranslation } from "@/hooks/useTranslation";
import { selectLearningLanguageLabel, useAppStore } from "@/store/useAppStore";
import { indexedDbClient } from "@/lib/indexedDb";
import type { FlowState } from "@/lib/lm-ai/types";

function extractVocabularyData(flowState: FlowState): {
  nodes: Array<{
    word: string;
    meaning?: string;
    phonetic?: string;
    tags?: string[];
    notes?: string;
  }>;
  links: Array<{
    start: string;
    end: string;
    relationship: string;
  }>;
} | null {
  const completeStep = flowState.steps.find(
    (s) => s.nodeId === "merge-nodes-links-pre"
  );

  if (completeStep?.result?.output) {
    const output = completeStep.result.output as Record<string, unknown>;

    if (output && typeof output === "object") {
      const nodes = (output.nodes as Array<unknown>) || [];
      const links = (output.links as Array<unknown>) || [];

      if (Array.isArray(nodes) && nodes.length > 0) {
        const extractedNodes: Array<{
          word: string;
          meaning?: string;
          phonetic?: string;
          tags?: string[];
          notes?: string;
        }> = [];

        for (const node of nodes) {
          if (typeof node === "object" && node !== null) {
            const nodeObj = node as Record<string, unknown>;
            const word = String(nodeObj.word || "").trim();
            if (!word) continue;

            extractedNodes.push({
              word,
              meaning: nodeObj.meaning ? String(nodeObj.meaning) : undefined,
              phonetic: nodeObj.phonetic ? String(nodeObj.phonetic) : undefined,
              tags: Array.isArray(nodeObj.tags)
                ? (nodeObj.tags as Array<unknown>).map((t) => String(t))
                : undefined,
              notes: nodeObj.notes ? String(nodeObj.notes) : undefined,
            });
          }
        }

        const extractedLinks = (Array.isArray(links) ? links : [])
          .map((link: unknown) => {
            if (typeof link === "object" && link !== null) {
              const linkObj = link as Record<string, unknown>;
              return {
                start: String(linkObj.start || ""),
                end: String(linkObj.end || ""),
                relationship: String(linkObj.relationship || ""),
              };
            }
            return null;
          })
          .filter(
            (
              link
            ): link is { start: string; end: string; relationship: string } =>
              link !== null &&
              link.start.trim() !== "" &&
              link.end.trim() !== ""
          );

        return {
          nodes: extractedNodes,
          links: extractedLinks,
        };
      }
    }
  }

  return null;
}

export default function ExtensionPage() {
  const { t } = useTranslation();
  const learningLanguageLabel = useAppStore(selectLearningLanguageLabel);
  const learningLanguage = useAppStore((state) => state.learningLanguage);

  const [showNotice, setShowNotice] = useState(false);
  const [completedState, setCompletedState] = useState<FlowState | null>(null);
  const [vocabularyCount, setVocabularyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadVocabularyCount = useCallback(async () => {
    try {
      setLoading(true);
      const graph = await indexedDbClient.getVocabulary(learningLanguage);
      setVocabularyCount(graph?.nodes?.length || 0);
    } catch (error) {
      console.error("Failed to load vocabulary count:", error);
      setVocabularyCount(0);
    } finally {
      setLoading(false);
    }
  }, [learningLanguage]);

  useEffect(() => {
    loadVocabularyCount();
  }, [loadVocabularyCount]);

  const handleWorkflowComplete = async (data: {
    action: string;
    success: boolean;
    state: FlowState;
  }) => {
    if (data.action === "extend-vocabulary" && data.success) {
      const vocabData = extractVocabularyData(data.state);
      if (vocabData && vocabData.nodes.length > 0) {
        setCompletedState(data.state);
        setShowNotice(true);
      }
    }
  };

  const handleConfirmGenerate = async () => {
    setShowNotice(false);

    if (!completedState) return;

    // Extract vocabulary data as nodes and links
    const vocabData = extractVocabularyData(completedState);
    if (vocabData && vocabData.nodes.length > 0) {
      try {
        const existingGraph = await indexedDbClient.getVocabulary(learningLanguage);
        const existingWords = new Set(
          (existingGraph?.nodes || []).map((n) => n.word.toLowerCase())
        );
        const newNodes = vocabData.nodes.filter(
          (node) => !existingWords.has(node.word.toLowerCase())
        );
        const mergedNodes = [...(existingGraph?.nodes || []), ...newNodes];
        const existingLinks = new Set(
          (existingGraph?.links || []).map(
            (l) => `${l.start.toLowerCase()}-${l.end.toLowerCase()}-${l.relationship}`
          )
        );
        const newLinks = vocabData.links.filter(
          (link) =>
            !existingLinks.has(
              `${link.start.toLowerCase()}-${link.end.toLowerCase()}-${link.relationship}`
            )
        );
        const mergedLinks = [...(existingGraph?.links || []), ...newLinks];

        await indexedDbClient.saveVocabulary({
          learningLanguage,
          nodes: mergedNodes,
          links: mergedLinks,
        });

        await loadVocabularyCount();
      } catch (error) {
        console.error("Failed to save vocabulary:", error);
      }
    }
    setCompletedState(null);
  };

  const handleCancelGenerate = () => {
    setShowNotice(false);
    setCompletedState(null);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-6 rounded-xl border border-transparent bg-gradient-to-r from-primary-50 via-surface-50 to-primary-50 p-4 sm:p-6 shadow-lg shadow-primary-100/60 dark:border-surface-700 dark:bg-surface-900">
        <div className="flex gap-2 items-baseline justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold text-primary-700 dark:text-primary-200">
            {t("superExtension")}
          </h1>
          <span className="text-xs sm:text-sm text-primary-700/80 dark:text-primary-100/80">
            {t("learningLanguage")}:{" "}
            <strong className="font-semibold">{learningLanguageLabel}</strong>
          </span>
        </div>
        <AIChatDialog
          action="extend-vocabulary"
          placeholder={t("extensionInputPlaceholder")}
          onComplete={handleWorkflowComplete}
        />
      </section>

      <section className="space-y-4 rounded-xl border border-transparent bg-gradient-to-r from-primary-50 via-surface-50 to-primary-50 p-4 sm:p-6 shadow-lg shadow-primary-100/60 dark:border-surface-700 dark:bg-surface-900">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold text-primary-700 dark:text-primary-200">
            {t("vocabularyGame") || "VocabularyGame"}
          </h1>
          {loading ? (
            <div className="text-sm text-muted-foreground">{t("loading") || "Loading..."}</div>
          ) : (
            <CounterCard
              count={vocabularyCount}
              label={t("vocabulary") || "Vocabulary"}
              onClick={() => {}}
              className="cursor-default hover:scale-100"
              scale={0.7}
            />
          )}
        </div>
      </section>

      {showNotice && (
        <Notice
          title={t("generateVocabulary") || "Add Vocabulary"}
          message={
            t("generateVocabularyMessage") ||
            "Add the generated vocabulary to your network?"
          }
          onConfirm={handleConfirmGenerate}
          onCancel={handleCancelGenerate}
          confirmLabel={t("saveAndView") || "Save and View"}
        />
      )}
    </div>
  );
}
