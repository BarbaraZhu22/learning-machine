"use client";

import { FormEvent, useState, useCallback, useEffect, useRef } from "react";
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
  shouldShowNodeResponse,
} from "./utils";
import { TypingMessageBox } from "@/components/common";
import containerStyles from "./css/index.module.css";
import workflowStyles from "./css/workflow.module.css";
import messageStyles from "./css/messages.module.css";
import formStyles from "./css/form.module.css";

export interface AIChatDialogProps {
  action?: string; // e.g., "simulate-dialog" or undefined for regular chat
  placeholder?: string;
  onSubmit?: (message: string) => void;
  onResponse?: (response: string) => void;
  onComplete?: (data: {
    action: string;
    success: boolean;
    state: FlowState;
  }) => void;
  className?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "workflow";
  content: string;
  timestamp: Date;
  nodeName?: string;
  isRunning?: boolean;
  hasError?: boolean;
  needsOperation?: boolean; // Whether this message is waiting for user operation
  operationNodeId?: string; // Node ID that triggered the operation
  operations?: Array<{ action: string; label: string }>; // Available operations for this message
  showResponse?: boolean; // Whether to show content (header always shows except for chat)
  isChatFlow?: boolean; // Whether this is a chat flow (affects header visibility)
}

export const AIChatDialog = ({
  action,
  placeholder,
  onSubmit,
  onResponse,
  onComplete,
  className = "",
}: AIChatDialogProps) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  // Extension state
  const [waitingForExtension, setWaitingForExtension] = useState(false);
  const [extensionInput, setExtensionInput] = useState("");
  const [extendingMessageId, setExtendingMessageId] = useState<string | null>(
    null
  );

  // Determine flowId: use action if provided, otherwise use "chat" for regular chat
  const flowId = action || "chat";

  // Flow controller - always use workflow approach
  const {
    state: flowState,
    status: flowStatus,
    error: flowError,
    isRunning,
    isWaitingConfirmation,
    currentStep,
    execute: executeFlow,
    reset: resetFlow,
    confirm: confirmFlow,
    reject: rejectFlow,
    restart: restartFlow,
  } = useFlowController({
    flowId,
    onEvent: (event: FlowEvent) => {
      // Handle flow events - unified approach for all workflows
      if (event.type === "step-start") {
        const eventData = event.data as { state?: FlowState } | undefined;
        const stateFromEvent = eventData?.state;
        const currentState = stateFromEvent || flowState || undefined;
        const nodeName = getNodeName(event.nodeId, currentState);
        const showResponse = shouldShowNodeResponse(event.nodeId, currentState);
        const isChatFlow = flowId === "chat";

        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "workflow",
            content: "",
            timestamp: new Date(),
            nodeName,
            isRunning: true,
            showResponse: showResponse ?? true, // Default to true if undefined
            isChatFlow,
          },
        ]);
      } else if (event.type === "step-complete" && event.data) {
        const stepData = event.data as { output?: unknown; state?: FlowState };
        const output = stepData?.output || event.data;
        const stateFromEvent = stepData?.state;
        const currentState = stateFromEvent || flowState || undefined;
        const nodeName = getNodeName(event.nodeId, currentState);
        const showResponse = shouldShowNodeResponse(event.nodeId, currentState);
        const isChatFlow = flowId === "chat";

        const outputStr = formatOutput(output);

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.role === "workflow" &&
            lastMsg.nodeName === nodeName
          ) {
            // Update existing message: stop typing and ensure content is set
            // If content was streamed, keep it; otherwise use the output
            return prev.map((msg) =>
              msg.id === lastMsg.id
                ? {
                    ...msg,
                    // Keep existing content if it was streamed, otherwise use output
                    content:
                      msg.content && msg.content.length > 0
                        ? msg.content
                        : outputStr,
                    isRunning: false,
                    hasError: false,
                    showResponse: showResponse ?? true, // Default to true if undefined
                    isChatFlow,
                  }
                : msg
            );
          } else {
            // Create new message if it doesn't exist (shouldn't happen, but handle it)
            return [
              ...prev,
              {
                id: createId(),
                role: "workflow",
                content: outputStr,
                timestamp: new Date(),
                nodeName,
                isRunning: false,
                hasError: false,
                showResponse: showResponse ?? true, // Default to true if undefined
                isChatFlow,
              },
            ];
          }
        });
      } else if (event.type === "step-error") {
        const eventData = event.data as { state?: FlowState } | undefined;
        const stateFromEvent = eventData?.state;
        const currentState = stateFromEvent || flowState || undefined;
        const nodeName = getNodeName(event.nodeId, currentState);
        const showResponse = shouldShowNodeResponse(event.nodeId, currentState);
        const isChatFlow = flowId === "chat";
        const errorMsg = event.error || "Unknown error";

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.role === "workflow" &&
            lastMsg.nodeName === nodeName
          ) {
            return prev.map((msg) =>
              msg.id === lastMsg.id
                ? {
                    ...msg,
                    content: `Error: ${errorMsg}`,
                    isRunning: false,
                    hasError: true,
                    showResponse: showResponse ?? true, // Default to true if undefined
                    isChatFlow,
                  }
                : msg
            );
          } else {
            return [
              ...prev,
              {
                id: createId(),
                role: "workflow",
                content: `Error: ${errorMsg}`,
                timestamp: new Date(),
                nodeName,
                isRunning: false,
                hasError: true,
                showResponse: showResponse ?? true, // Default to true if undefined
                isChatFlow,
              },
            ];
          }
        });
      } else if (event.type === "stream-chunk") {
        // Append chunk to the last message (same message box)
        // Handle both string and JSON data
        const chunkStr =
          typeof event.data === "string"
            ? event.data
            : formatOutput(event.data);

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "workflow" && lastMsg.isRunning) {
            // Append chunk to existing content (incremental update)
            return prev.map((msg) =>
              msg.id === lastMsg.id
                ? { ...msg, content: (msg.content || "") + chunkStr }
                : msg
            );
          }
          return prev;
        });
      } else if (event.type === "operation-required") {
        // confirm & restart etc.
        const nodeName = getNodeName(event.nodeId, flowState || undefined);
        const operations = event.operations || [];
        setMessages((prev) => {
          for (let i = prev.length - 1; i >= 0; i--) {
            const msg = prev[i];
            if (msg.role === "workflow") {
              const matches =
                msg.nodeName === nodeName ||
                (event.nodeId &&
                  msg.nodeName
                    ?.toLowerCase()
                    .includes(event.nodeId.toLowerCase()));

              if (matches) {
                return prev.map((m) =>
                  m.id === msg.id
                    ? {
                        ...m,
                        needsOperation: true,
                        operationNodeId: event.nodeId || "",
                        operations,
                      }
                    : m
                );
              }
            }
          }
          const lastWorkflowMsg = prev
            .filter((m) => m.role === "workflow")
            .pop();
          if (lastWorkflowMsg) {
            return prev.map((m) =>
              m.id === lastWorkflowMsg.id
                ? {
                    ...m,
                    needsOperation: true,
                    operationNodeId: event.nodeId || "",
                    operations,
                  }
                : m
            );
          }
          return prev;
        });
      } else if (
        event.type === "status-change" &&
        event.status === "completed"
      ) {
        if (event.data) {
          const eventData = event.data as { state?: FlowState };
          if (eventData?.state) {
            const outputStr = extractFinalOutput(eventData.state);
            if (outputStr) {
              onResponse?.(outputStr);
            }
            // Mark as completed - will be handled in useEffect
            completedRef.current = true;
          }
        }
        setMessages((prev) =>
          prev.map((msg) => ({
            ...msg,
            needsOperation: false,
            operationNodeId: undefined,
          }))
        );
        setWaitingForExtension(false);
      }
    },
    onStateChange: (state: FlowState) => {
      if (state.status === "completed" || state.status === "error") {
        setIsLoading(false);
        setWaitingForExtension(false);
        if (state.status === "completed") {
          const outputStr = extractFinalOutput(state);
          if (outputStr) {
            onResponse?.(outputStr);
          }
          // Mark as completed - will be handled in useEffect
          completedRef.current = true;
        }
      } else if (state.status === "waiting-operation") {
        if (!waitingForExtension) {
          setIsLoading(false);
        }
      }
    },
  });

  // Unified workflow handler - always use workflow approach
  const handleSubmit = useCallback(
    async (userMessage: string) => {
      setIsLoading(true);
      resetFlow();

      // Parse input based on action
      const input = action
        ? parseWorkflowInput(action, userMessage)
        : userMessage; // For chat, just pass the message

      const appState = useAppStore.getState();
      const context = {
        learningLanguage: appState.learningLanguage,
        userLanguage: appState.language,
        // For chat flow, include conversation history
        ...(flowId === "chat" && {
          conversationHistory: messages
            .filter(
              (m) =>
                m.role === "user" || (m.role === "workflow" && m.isChatFlow)
            )
            .map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            })),
        }),
      };

      try {
        await executeFlow(input, context);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "workflow") {
            return prev.map((msg) =>
              msg.id === lastMsg.id
                ? {
                    ...msg,
                    content: `Error: ${errorMessage}`,
                    isRunning: false,
                    hasError: true,
                  }
                : msg
            );
          }
          return prev;
        });
        setIsLoading(false);
      }
    },
    [action, executeFlow, resetFlow, flowId, messages]
  );

  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || (isLoading && !waitingForExtension)) return;

    // If waiting for extension, handle it differently
    if (waitingForExtension) {
      onSubmit?.(trimmedMessage);

      const userMsg: ChatMessage = {
        id: createId(),
        role: "user",
        content: trimmedMessage,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setMessage("");
      setWaitingForExtension(false);

      // Find restart operation from current message
      const currentMsg = messages.find((m) => m.needsOperation && m.operations);
      const restartOp = currentMsg?.operations?.find(
        (op) => op.action === "restart"
      );
      if (restartOp) {
        try {
          await restartFlow(trimmedMessage, "restart");
        } catch (error) {
          // Silently handle errors
        }
      }
      return;
    }

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

    // Execute workflow
    try {
      await handleSubmit(trimmedMessage);
    } catch (error) {
      // Silently handle errors
    }
  };

  // Update loading state based on flow status
  useEffect(() => {
    if (flowStatus === "completed" || flowStatus === "error") {
      setIsLoading(false);
      setWaitingForExtension(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === "workflow" && msg.isRunning
            ? { ...msg, isRunning: false }
            : msg
        )
      );
    } else if (flowStatus === "waiting-operation") {
      setIsLoading(false);
    } else if (flowStatus === "running") {
      if (!waitingForExtension) {
        setIsLoading(true);
      }
    }
  }, [flowStatus, waitingForExtension]);

  // Handle completion callback after render
  useEffect(() => {
    if (
      completedRef.current &&
      flowStatus === "completed" &&
      flowState &&
      action &&
      onComplete
    ) {
      completedRef.current = false; // Reset to prevent multiple calls
      // Use setTimeout to ensure this runs after render
      setTimeout(() => {
        onComplete({
          action,
          success: true,
          state: flowState,
        });
      }, 0);
    }
  }, [flowStatus, flowState, action, onComplete]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className={`${containerStyles.container} ${className}`}>
      {/* Chat Messages */}
      {messages.length > 0 && (
        <div className={messageStyles.chatContainer}>
          <div
            ref={messagesContainerRef}
            className={messageStyles.messagesContainer}
          >
            {messages.map((msg) => {
              // Skip empty workflow messages (but always show error messages and running messages)
              if (
                msg.role === "workflow" &&
                !msg.content?.trim() &&
                !msg.isRunning &&
                !msg.hasError
              ) {
                return null;
              }

              // Render workflow messages
              if (msg.role === "workflow") {
                // Unified workflow message structure - use CSS to show/hide parts
                const hasContent = msg.content && msg.content.length > 0;
                // Header always shows for workflow messages (except chat flow)
                const showHeader = !msg.isChatFlow;
                // Content shows when showResponse is true (defaults to true) and there's content or error
                const showContent =
                  msg.showResponse !== false && (hasContent || msg.hasError);
                // Show typing only when: running, no content yet, no error
                const showTyping =
                  msg.isRunning &&
                  !hasContent &&
                  !msg.hasError &&
                  msg.showResponse !== false;
                const showButtons = msg.needsOperation;

                return (
                  <div
                    key={msg.id}
                    className={workflowStyles.workflowMessageWrapper}
                  >
                    <div className={workflowStyles.workflowMessageBubble}>
                      {/* Header */}
                      <div
                        className={`${workflowStyles.workflowMessageHeader} ${
                          !showHeader
                            ? workflowStyles.workflowMessageHidden
                            : ""
                        }`}
                      >
                        <span
                          className={`${workflowStyles.workflowMessageIcon} ${
                            msg.hasError
                              ? workflowStyles.workflowMessageIconError
                              : msg.isRunning
                              ? workflowStyles.workflowMessageIconRunning
                              : workflowStyles.workflowMessageIconSuccess
                          }`}
                        >
                          {msg.hasError ? "✕" : msg.isRunning ? "●" : "✔"}
                        </span>
                        <span className={workflowStyles.workflowMessageTitle}>
                          {msg.nodeName || "Workflow Step"}
                        </span>
                      </div>

                      {/* Content */}
                      <div
                        className={`${workflowStyles.workflowMessageContent} ${
                          !showContent
                            ? workflowStyles.workflowMessageHidden
                            : ""
                        }`}
                      >
                        {msg.hasError ? (
                          <span>Error occurred</span>
                        ) : hasContent ? (
                          // If running, use TypingMessageBox for streaming effect
                          // If completed, show static content
                          msg.isRunning ? (
                            <TypingMessageBox
                              text={msg.content}
                              speed={15}
                              messageId={msg.id}
                              showCursor={true}
                            />
                          ) : (
                            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                              {msg.content}
                            </pre>
                          )
                        ) : null}
                      </div>

                      {/* Typing Indicator */}
                      <div
                        className={`${workflowStyles.workflowMessageTyping} ${
                          !showTyping
                            ? workflowStyles.workflowMessageHidden
                            : ""
                        }`}
                      >
                        <span className={messageStyles.typingCursor}>|</span>
                      </div>

                      {/* Buttons */}
                      <div
                        className={`${workflowStyles.confirmationActions} ${
                          !showButtons
                            ? workflowStyles.workflowMessageHidden
                            : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={async () => {
                            await confirmFlow();
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === msg.id
                                  ? { ...m, needsOperation: false }
                                  : m
                              )
                            );
                          }}
                          className={workflowStyles.confirmButton}
                        >
                          {t("confirm") || "Confirm"}
                        </button>
                        {/* Show restart/extend button if operation exists */}
                        {msg.operations?.some(
                          (op) => op.action === "restart"
                        ) &&
                          !extendingMessageId && (
                            <button
                              type="button"
                              onClick={async () => {
                                setExtendingMessageId(msg.id);
                                setWaitingForExtension(true);
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.id === msg.id
                                      ? { ...m, needsOperation: false }
                                      : m
                                  )
                                );
                              }}
                              className={workflowStyles.extendButton}
                            >
                              {msg.operations?.find(
                                (op) => op.action === "restart"
                              )?.label ||
                                t("extend") ||
                                "Extend"}
                            </button>
                          )}
                      </div>

                      {/* Extension Input - shown when this message is being extended */}
                      {extendingMessageId === msg.id && (
                        <div className={workflowStyles.extensionInputContainer}>
                          <input
                            type="text"
                            value={extensionInput}
                            onChange={(e) => setExtensionInput(e.target.value)}
                            placeholder={
                              t("extensionInputPlaceholder") ||
                              msg.operationNodeId === "dialog-check"
                                ? "Describe how you'd like to extend the dialog..."
                                : "Enter your input..."
                            }
                            className={workflowStyles.extensionInput}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                const trimmedInput = extensionInput.trim();
                                if (!trimmedInput) return;

                                // Add user message
                                const userMsg: ChatMessage = {
                                  id: createId(),
                                  role: "user",
                                  content: trimmedInput,
                                  timestamp: new Date(),
                                };
                                setMessages((prev) => [...prev, userMsg]);
                                setExtensionInput("");
                                setWaitingForExtension(false);
                                setExtendingMessageId(null);

                                try {
                                  // Find the restart operation
                                  const restartOp = msg.operations?.find(
                                    (op) => op.action === "restart"
                                  );
                                  if (restartOp) {
                                    await restartFlow(trimmedInput, "restart");
                                  }
                                } catch (error) {
                                  // Silently handle errors
                                }
                              }
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const trimmedInput = extensionInput.trim();
                              if (!trimmedInput) return;

                              // Add user message
                              const userMsg: ChatMessage = {
                                id: createId(),
                                role: "user",
                                content: trimmedInput,
                                timestamp: new Date(),
                              };
                              setMessages((prev) => [...prev, userMsg]);
                              setExtensionInput("");
                              setWaitingForExtension(false);
                              setExtendingMessageId(null);

                              try {
                                const restartOp = msg.operations?.find(
                                  (op) => op.action === "restart"
                                );
                                if (restartOp) {
                                  await restartFlow(trimmedInput, "restart");
                                }
                              } catch (error) {
                                // Silently handle errors
                              }
                            }}
                            className={workflowStyles.extensionSendButton}
                            disabled={!extensionInput.trim()}
                          >
                            {t("send") || "Send"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setExtensionInput("");
                              setWaitingForExtension(false);
                              setExtendingMessageId(null);
                            }}
                            className={workflowStyles.extensionCancelButton}
                          >
                            {t("cancel") || "Cancel"}
                          </button>
                        </div>
                      )}

                      {/* Timestamp */}
                      <div className={workflowStyles.workflowMessageTimestamp}>
                        {msg.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              }

              // Render user messages
              return (
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
                      {msg.content.trim()}
                    </div>
                    <div className={messageStyles.messageTimestamp}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleFormSubmit} className={formStyles.inputForm}>
        <div className={formStyles.inputFormInner}>
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
            disabled={isLoading || waitingForExtension}
            className={formStyles.inputField}
          />
          <button
            type="submit"
            disabled={!message.trim() || (isLoading && !waitingForExtension)}
            className={formStyles.submitButton}
          >
            {isLoading && !waitingForExtension ? "..." : t("send") || "Send"}
          </button>
        </div>
      </form>
    </div>
  );
};
