"use client";

import { FormEvent, useState, useCallback, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useFlowController } from "@/hooks/useFlowController";
import { useAppStore } from "@/store/useAppStore";
import type { FlowState, FlowEvent } from "@/lib/lm-ai/types";
import {
  createId,
  getNodeName,
  formatOutput,
  parseWorkflowInput,
  extractFinalOutput,
  isStepStartMessage,
} from "./utils";
import containerStyles from "./index.module.css";
import workflowStyles from "./workflow.module.css";
import messageStyles from "./messages.module.css";
import formStyles from "./form.module.css";

export interface AIChatDialogProps {
  action?: string; // e.g., "simulate-dialog"
  placeholder?: string;
  onSubmit?: (message: string) => void;
  onResponse?: (response: string) => void;
  className?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export const AIChatDialog = ({
  action,
  placeholder,
  onSubmit,
  onResponse,
  className = "",
}: AIChatDialogProps) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const aiConfig = useAppStore((state) => state.aiConfig);

  // Flow controller for workflow mode
  const {
    state: flowState,
    status: flowStatus,
    error: flowError,
    isRunning,
    currentStep,
    execute: executeFlow,
    reset: resetFlow,
  } = useFlowController({
    flowId: action || "",
    onEvent: (event: FlowEvent) => {
      // Handle flow events
      if (event.type === "step-start") {
        // When a step starts, create a new message for this node
        const eventData = event.data as { state?: FlowState } | undefined;
        const stateFromEvent = eventData?.state;
        const nodeName = getNodeName(event.nodeId, stateFromEvent || flowState || undefined);
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content: `🔄 **${nodeName}**\n\nStarting...`,
            timestamp: new Date(),
          },
        ]);
      } else if (event.type === "step-complete" && event.data) {
        // When a step completes, update the last message with the node's output
        const stepData = event.data as { output?: unknown; state?: FlowState };
        const output = stepData?.output || event.data;
        const stateFromEvent = stepData?.state;
        const nodeName = getNodeName(event.nodeId, stateFromEvent || flowState || undefined);
        const outputStr = formatOutput(output);

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.role === "assistant" &&
            isStepStartMessage(lastMsg.content)
          ) {
            // Update the step-start message with the result
            return prev.map((msg) =>
              msg.id === lastMsg.id
                ? {
                    ...msg,
                    content: `✅ **${nodeName}**\n\n${outputStr}`,
                  }
                : msg
            );
          } else {
            // Create a new message if we can't find the step-start message
            return [
              ...prev,
              {
                id: createId(),
                role: "assistant",
                content: `✅ **${nodeName}**\n\n${outputStr}`,
                timestamp: new Date(),
              },
            ];
          }
        });
      } else if (event.type === "step-error") {
        // Handle step errors
        const eventData = event.data as { state?: FlowState } | undefined;
        const stateFromEvent = eventData?.state;
        const nodeName = getNodeName(event.nodeId, stateFromEvent || flowState || undefined);
        const errorMsg = event.error || "Unknown error";
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.role === "assistant" &&
            isStepStartMessage(lastMsg.content)
          ) {
            return prev.map((msg) =>
              msg.id === lastMsg.id
                ? {
                    ...msg,
                    content: `❌ **${nodeName}**\n\nError: ${errorMsg}`,
                  }
                : msg
            );
          } else {
            return [
              ...prev,
              {
                id: createId(),
                role: "assistant",
                content: `❌ **${nodeName}**\n\nError: ${errorMsg}`,
                timestamp: new Date(),
              },
            ];
          }
        });
      } else if (
        event.type === "stream-chunk" &&
        typeof event.data === "string"
      ) {
        // Update last assistant message with streaming content
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            return prev.map((msg) =>
              msg.id === lastMsg.id
                ? { ...msg, content: event.data as string }
                : msg
            );
          }
          return prev;
        });
      } else if (
        event.type === "status-change" &&
        event.status === "completed"
      ) {
        // Final completion
        if (event.data) {
          const eventData = event.data as { state?: FlowState };
          if (eventData?.state) {
            const outputStr = extractFinalOutput(eventData.state);
            if (outputStr) {
              onResponse?.(outputStr);
            }
          }
        }
      }
    },
    onStateChange: (state: FlowState) => {
      if (state.status === "completed" || state.status === "error") {
        setIsLoading(false);
        if (state.status === "completed") {
          const outputStr = extractFinalOutput(state);
          if (outputStr) {
            onResponse?.(outputStr);
          }
        }
      }
    },
  });

  // Regular chat mode (non-workflow)
  const handleRegularChat = useCallback(
    async (userMessage: string) => {
      if (!aiConfig) {
        const error = "AI configuration not set";
        throw new Error(error);
      }

      setIsLoading(true);
      const requestBody = {
        provider: aiConfig.provider,
        apiUrl: aiConfig.apiUrl,
        model: aiConfig.model,
        messages: [
          ...messages
            .filter((m) => m.role === "assistant" || m.role === "user")
            .map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            })),
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        maxTokens: 2000,
      };

      try {
        const response = await fetch("/api/llm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get response");
        }

        const data = await response.json();
        const assistantMessage = data.data || "";

        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content: assistantMessage,
            timestamp: new Date(),
          },
        ]);

        onResponse?.(assistantMessage);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content: `Error: ${errorMessage}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, aiConfig, onResponse]
  );

  // Workflow mode
  const handleWorkflowChat = useCallback(
    async (userMessage: string) => {
      if (!action) {
        return;
      }

      setIsLoading(true);
      resetFlow();

      // Parse input based on action
      const input = parseWorkflowInput(action, userMessage);

      const appState = useAppStore.getState();
      const context = {
        learningLanguage: appState.learningLanguage,
        userLanguage: appState.language,
      };

      // Add initial assistant message for streaming
      const assistantMsg: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        await executeFlow(input, context);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            return prev.map((msg) =>
              msg.id === lastMsg.id
                ? { ...msg, content: `Error: ${errorMessage}` }
                : msg
            );
          }
          return prev;
        });
        setIsLoading(false);
      }
    },
    [action, executeFlow, resetFlow, aiConfig]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isLoading) return;

    onSubmit?.(trimmedMessage);

    // Add user message
    const userMsg: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmedMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setMessage("");

    // Execute based on mode
    try {
      if (action) {
        await handleWorkflowChat(trimmedMessage);
      } else {
        await handleRegularChat(trimmedMessage);
      }
    } catch (error) {
      // Silently handle errors
    }
  };

  // Update loading state based on flow status
  useEffect(() => {
    if (flowStatus === "completed" || flowStatus === "error") {
      setIsLoading(false);
    } else if (flowStatus === "running") {
      setIsLoading(true);
    }
  }, [flowStatus]);

  // Helper function to get status badge class
  const getStatusBadgeClass = () => {
    switch (flowStatus) {
      case "running":
        return workflowStyles.workflowStatusBadgeRunning;
      case "completed":
        return workflowStyles.workflowStatusBadgeCompleted;
      case "error":
        return workflowStyles.workflowStatusBadgeError;
      case "paused":
        return workflowStyles.workflowStatusBadgePaused;
      default:
        return workflowStyles.workflowStatusBadgeIdle;
    }
  };

  // Helper function to get step class
  const getStepClass = (index: number, step: { executed: boolean }) => {
    if (index === currentStep && isRunning) {
      return `${workflowStyles.workflowStep} ${workflowStyles.workflowStepActive}`;
    }
    if (step.executed) {
      return `${workflowStyles.workflowStep} ${workflowStyles.workflowStepCompleted}`;
    }
    return `${workflowStyles.workflowStep} ${workflowStyles.workflowStepPending}`;
  };

  // Helper function to get step dot class
  const getStepDotClass = (index: number, step: { executed: boolean }) => {
    if (index === currentStep && isRunning) {
      return `${workflowStyles.workflowStepDot} ${workflowStyles.workflowStepDotActive}`;
    }
    if (step.executed) {
      return `${workflowStyles.workflowStepDot} ${workflowStyles.workflowStepDotCompleted}`;
    }
    return `${workflowStyles.workflowStepDot} ${workflowStyles.workflowStepDotPending}`;
  };

  // Only show workflow status when there's an active workflow
  const hasActiveWorkflow =
    action &&
    ((flowState?.steps && flowState.steps.length > 0) ||
      flowStatus === "running" ||
      flowStatus === "completed" ||
      flowStatus === "error" ||
      flowStatus === "paused");

  return (
    <div className={`${containerStyles.container} ${className}`}>
      {/* Workflow Status Display - Only show when workflow is active */}
      {hasActiveWorkflow && (
        <div className={workflowStyles.workflowStatus}>
          <div className={workflowStyles.workflowStatusInner}>
            <div className={workflowStyles.workflowStepsContainer}>
              {flowState && flowState.steps.length > 0 ? (
                flowState.steps.map((step, index) => (
                  <div key={step.nodeId} className={getStepClass(index, step)}>
                    <div className={getStepDotClass(index, step)} />
                    <span className={workflowStyles.workflowStepName}>
                      {step.node.name}
                    </span>
                    {step.executed && (
                      <span className={workflowStyles.workflowStepCheck}>✓</span>
                    )}
                  </div>
                ))
              ) : (
                <div className={workflowStyles.workflowStatusLabel}>
                  {flowStatus === "running"
                    ? "Initializing..."
                    : "Not started"}
                </div>
              )}
            </div>
            {flowStatus && flowStatus !== "idle" && (
              <div className="shrink-0">
                <span
                  className={`${workflowStyles.workflowStatusBadge} ${getStatusBadgeClass()}`}
                >
                  {flowStatus}
                </span>
              </div>
            )}
          </div>
          {flowError && (
            <div className={workflowStyles.workflowError}>{flowError}</div>
          )}
        </div>
      )}

      {/* Chat Messages */}
      {messages.length > 0 && (
        <div className={messageStyles.chatContainer}>
          <div className={messageStyles.messagesContainer}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`${messageStyles.messageWrapper} ${
                  msg.role === "user"
                    ? messageStyles.messageWrapperUser
                    : messageStyles.messageWrapperAssistant
                }`}
              >
                <div
                  className={`${messageStyles.messageBubble} ${
                    msg.role === "user"
                      ? messageStyles.messageBubbleUser
                      : messageStyles.messageBubbleAssistant
                  }`}
                >
                  <div className={messageStyles.messageContent}>
                    {msg.content ||
                      (isLoading && msg.role === "assistant" ? "..." : "")}
                  </div>
                  <div className={messageStyles.messageTimestamp}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className={formStyles.inputForm}>
        <div className={formStyles.inputFormInner}>
          {action && (
            <span className={formStyles.actionBadge}>{action}</span>
          )}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              placeholder ||
              (action
                ? `Enter input for ${action} workflow...`
                : "Type your message...")
            }
            disabled={isLoading}
            className={formStyles.inputField}
          />
          <button
            type="submit"
            disabled={!message.trim() || isLoading}
            className={formStyles.submitButton}
          >
            {isLoading ? "..." : t("send") || "Send"}
          </button>
        </div>
      </form>
    </div>
  );
};
