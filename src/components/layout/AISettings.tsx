"use client";

import { useState, FormEvent } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAppStore } from "@/store/useAppStore";
import type { LLMProvider } from "@/types";

const providerOptions: { value: LLMProvider; label: string }[] = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "custom", label: "Custom API" },
];

const defaultModels: Record<LLMProvider, string> = {
  deepseek: "deepseek-chat",
  openai: "gpt-4",
  anthropic: "claude-3-5-sonnet-20241022",
  custom: "",
};

export const AISettings = () => {
  const { t } = useTranslation();
  const aiConfig = useAppStore((state) => state.aiConfig);
  const setAIConfig = useAppStore((state) => state.setAIConfig);

  const [isOpen, setIsOpen] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>(
    aiConfig?.provider || "deepseek"
  );
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || "");
  const [apiUrl, setApiUrl] = useState(aiConfig?.apiUrl || "");
  const [model, setModel] = useState(
    aiConfig?.model || defaultModels[provider]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim() && provider !== "custom") {
      alert(t("aiApiKeyRequired") || "API Key is required");
      return;
    }

    setAIConfig({
      provider,
      apiKey: apiKey.trim(),
      apiUrl: apiUrl.trim() || undefined,
      model: model.trim() || defaultModels[provider] || undefined,
    });

    setIsOpen(false);
  };

  const handleClear = () => {
    setAIConfig(null);
    setApiKey("");
    setApiUrl("");
    setModel(defaultModels[provider]);
    setIsOpen(false);
  };

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    setModel(defaultModels[newProvider]);
    if (newProvider !== "custom") {
      setApiUrl("");
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-surface-200/60 bg-[color:var(--glass-base)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-700 shadow-sm backdrop-blur transition hover:border-primary-400 hover:bg-[color:var(--glass-accent)] dark:border-surface-600 dark:bg-surface-800/70 dark:text-primary-200 dark:hover:border-surface-500"
        title={t("aiSettings") || "AI Settings"}
      >
        {aiConfig ? "🤖 AI ✓" : "🤖 AI"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-surface-200/50 bg-[color:var(--glass-base)] p-6 shadow-2xl backdrop-blur dark:border-surface-700 dark:bg-surface-900">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 text-primary-700 hover:text-primary-900 dark:text-primary-200 dark:hover:text-primary-100"
        >
          ✕
        </button>

        <h2 className="mb-4 text-2xl font-semibold text-primary-700 dark:text-primary-200">
          {t("aiSettings") || "AI Settings"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-200">
              {t("aiProvider") || "AI Provider"}
            </label>
            <select
              value={provider}
              onChange={(e) =>
                handleProviderChange(e.target.value as LLMProvider)
              }
              className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-primary-700 outline-none transition focus:border-primary-400 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-200"
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-200">
              {t("aiApiKey") || "API Key"}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("aiApiKeyPlaceholder") || "Enter your API key"}
              className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-primary-700 outline-none transition focus:border-primary-400 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-200"
            />
            <p className="mt-1 text-xs text-primary-600/70 dark:text-primary-300/70">
              {t("aiApiKeyHint") || "Stored locally in your browser"}
            </p>
          </div>

          {provider === "custom" && (
            <div>
              <label className="block text-sm font-medium text-primary-700 dark:text-primary-200">
                {t("aiApiUrl") || "API URL"}
              </label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.example.com/v1/chat/completions"
                className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-primary-700 outline-none transition focus:border-primary-400 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-200"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-200">
              {t("aiModel") || "Model (Optional)"}
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={defaultModels[provider]}
              className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-primary-700 outline-none transition focus:border-primary-400 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-200"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
            >
              {t("save") || "Save"}
            </button>
            {aiConfig && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-surface-100 dark:border-surface-600 dark:text-primary-200 dark:hover:bg-surface-800"
              >
                {t("clear") || "Clear"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-primary-700 transition hover:bg-surface-100 dark:border-surface-600 dark:text-primary-200 dark:hover:bg-surface-800"
            >
              {t("cancel") || "Cancel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
