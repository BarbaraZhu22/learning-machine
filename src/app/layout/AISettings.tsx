"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  openai: "gpt-3.5-turbo",
  anthropic: "claude-3-5-sonnet-20241022",
  custom: "",
};

const providerTokenLinks: Record<LLMProvider, string> = {
  deepseek: "https://platform.deepseek.com/api_keys",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  custom: "",
};

export const AISettings = () => {
  const { t } = useTranslation();
  const aiConfig = useAppStore((state) => state.aiConfig);
  const setAIConfig = useAppStore((state) => state.setAIConfig);

  const isMountedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>(
    aiConfig?.provider || "deepseek"
  );
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || "");
  const [apiUrl, setApiUrl] = useState(aiConfig?.apiUrl || "");
  const [model, setModel] = useState(
    aiConfig?.model || defaultModels[provider]
  );
  const [expirationDays, setExpirationDays] = useState(30);

  // Ensure component is mounted before using portal
  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim() && provider !== "custom") {
      alert(t("aiApiKeyRequired") || "API Key is required");
      return;
    }

    try {
      // Save API key to HTTP-only cookie via API endpoint
      const response = await fetch("/api/ai-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          apiUrl: apiUrl.trim() || undefined,
          model: model.trim() || defaultModels[provider] || undefined,
          expirationDays,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save AI configuration");
      }

      // Store non-sensitive config in store (without apiKey)
      setAIConfig({
        provider,
        apiKey: "", // Don't store in localStorage
        apiUrl: apiUrl.trim() || undefined,
        model: model.trim() || defaultModels[provider] || undefined,
      });

      setIsOpen(false);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to save AI configuration"
      );
    }
  };

  const handleClear = async () => {
    try {
      // Clear the HTTP-only cookie
      await fetch("/api/ai-config", {
        method: "DELETE",
      });

      setAIConfig(null);
      setApiKey("");
      setApiUrl("");
      setModel(defaultModels[provider]);
      setIsOpen(false);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to clear AI configuration"
      );
    }
  };

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    setModel(defaultModels[newProvider]);
    if (newProvider !== "custom") {
      setApiUrl("");
    }
  };

  const modalContent = isOpen ? (
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
            <div className="mt-1 space-y-1">
              <p className="text-xs text-primary-600/70 dark:text-primary-300/70">
                {t("aiApiKeyHint") ||
                  "Stored in HTTP-only cookie, local and safe"}
              </p>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("aiApiKeyPlaceholder") || "Enter your API key"}
              className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-primary-700 outline-none transition focus:border-primary-400 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-700 dark:text-primary-200">
              {t("aiCookieExpiration") || "Cookie Expiration"}
            </label>
            <div className="mt-1 space-y-1">
              <p className="mt-1 text-xs text-primary-600/70 dark:text-primary-300/70">
                {(
                  t("aiCookieExpirationHint") ||
                  "Expires in {days} days • SameSite: Lax (secure same-site requests)"
                ).replace("{days}", expirationDays.toString())}
              </p>
            </div>
            <select
              value={expirationDays}
              onChange={(e) => setExpirationDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-primary-700 outline-none transition focus:border-primary-400 dark:border-surface-600 dark:bg-surface-800 dark:text-primary-200"
            >
              <option value={15}>
                15 {t("aiCookieExpirationDays") || "days"}
              </option>
              <option value={30}>
                30 {t("aiCookieExpirationDays") || "days"}
              </option>
              <option value={60}>
                60 {t("aiCookieExpirationDays") || "days"}
              </option>
              <option value={365}>
                365 {t("aiCookieExpirationDays") || "days"}
              </option>
            </select>

            {provider !== "custom" && providerTokenLinks[provider] && (
              <p className="mt-1 text-xs">
                <a
                  href={providerTokenLinks[provider]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-500 hover:text-primary-700 underline dark:text-primary-400 dark:hover:text-primary-300"
                >
                  {(
                    t("aiGetApiKey") || "How to get {provider} API key"
                  ).replace(
                    "{provider}",
                    providerOptions.find((p) => p.value === provider)?.label ||
                      ""
                  )}{" "}
                  →
                </a>
              </p>
            )}
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
  ) : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-surface-200/60 bg-[color:var(--glass-base)] px-3 py-1 font-medium text-primary-700 shadow-sm transition hover:-translate-y-0.5 hover:border-surface-300/60 hover:bg-[color:var(--glass-accent)] hover:text-primary-900 dark:border-surface-700/60 dark:bg-surface-800/65 dark:text-primary-200 dark:hover:border-surface-600/60 dark:hover:bg-surface-800/80 dark:hover:text-primary-100"
        title={t("aiSettings") || "AI Settings"}
      >
        {aiConfig ? "🤖 AI ✓" : "🤖 AI"}
      </button>
      {isMountedRef &&
        modalContent &&
        createPortal(modalContent, document.body)}
    </>
  );
};
