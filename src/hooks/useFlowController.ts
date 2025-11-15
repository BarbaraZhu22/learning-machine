/**
 * Client-side hook for controlling flow execution
 * Handles streaming, state management, and user interactions
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  FlowState,
  FlowEvent,
  FlowStatus,
  FlowExecutionRequest,
} from "@/lib/lm-ai/types";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/hooks/useTranslation";

interface UseFlowControllerOptions {
  flowId: string;
  onEvent?: (event: FlowEvent) => void;
  onStateChange?: (state: FlowState) => void;
  continueOnFailure?: boolean;
}

interface UseFlowControllerReturn {
  state: FlowState | null;
  status: FlowStatus;
  error: string | null;
  isRunning: boolean;
  isPaused: boolean;
  isWaitingConfirmation: boolean;
  currentStep: number;
  events: FlowEvent[];
  execute: (input: unknown, context?: Record<string, unknown>) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  confirm: (data?: unknown) => Promise<void>;
  reject: () => Promise<void>;
  restart: (data?: unknown, operationAction?: string) => Promise<void>;
  extend: (data?: unknown, operationAction?: string) => Promise<void>; // Alias for restart
  reset: () => void;
}

export function useFlowController(
  options: UseFlowControllerOptions
): UseFlowControllerReturn {
  const { flowId, onEvent, onStateChange, continueOnFailure } = options;

  const { t } = useTranslation();
  const aiConfig = useAppStore((state) => state.aiConfig);

  const [state, setState] = useState<FlowState | null>(null);
  const [events, setEvents] = useState<FlowEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const updateState = useCallback(
    (newState: FlowState) => {
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  const handleEvent = useCallback(
    (event: FlowEvent) => {
      setEvents((prev) => [...prev, event]);
      onEvent?.(event);

      // Update state from event if available
      if (event.type === "status-change") {
        setState((prev) => {
          // If event has full state data, use it (this is the final state with all step results)
          if (event.data) {
            const eventData = event.data as {
              sessionId?: string;
              state?: FlowState;
            };
            if (eventData?.state) {
              // Use the full state from the event - this is the final state with all results
              updateState(eventData.state);
              return eventData.state;
            }
          }
          
          // Otherwise, just update the status if provided
          if (event.status && prev) {
            const updated: FlowState = {
              ...prev,
              status: event.status as FlowStatus,
            };
            updateState(updated);
            return updated;
          }
          return prev;
        });
      }
    },
    [onEvent, updateState]
  );

  const execute = useCallback(
    async (input: unknown, context?: Record<string, unknown>) => {
      // Abort previous execution if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setError(null);
      setEvents([]);

      try {
        const request: FlowExecutionRequest = {
          flowId,
          input,
          context,
          continueOnFailure,
          // Note: apiKey is now stored in HTTP-only cookie, not sent in request body
          aiConfig: aiConfig
            ? {
                provider: aiConfig.provider,
                // Don't send apiKey - it's read from HTTP-only cookie on server
                apiUrl: aiConfig.apiUrl,
                model: aiConfig.model,
              }
            : undefined,
        };

        const response = await fetch("/api/flow/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          // Handle API key missing error with translated message
          if (errorData.error === "API_KEY_MISSING") {
            const errorMessage = `${t("aiApiKeyMissing")}: ${t(
              "aiApiKeyMissingMessage"
            )}`;
            throw new Error(errorMessage);
          }
          throw new Error(
            errorData.message || errorData.error || "Flow execution failed"
          );
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: FlowEvent = JSON.parse(line.slice(6));

                // Extract session ID from first event
                if (!sessionIdRef.current && event.flowId) {
                  // Session ID will be in the state, we'll get it from status endpoint
                }

                // Handle error events with API key missing
                if (event.type === "step-error" && event.error) {
                  const errorMsg = event.error;
                  if (
                    errorMsg.includes("API_KEY_MISSING") ||
                    errorMsg.includes("API key not configured")
                  ) {
                    const translatedError = `${t("aiApiKeyMissing")}: ${t(
                      "aiApiKeyMissingMessage"
                    )}`;
                    setError(translatedError);
                    setState((prev) => {
                      if (prev) {
                        const updated: FlowState = {
                          ...prev,
                          status: "error" as FlowStatus,
                          error: translatedError,
                        };
                        updateState(updated);
                        return updated;
                      }
                      return prev;
                    });
                    return;
                  }
                }

                handleEvent(event);

                // Extract session ID from state-change events
                if (event.type === "status-change" && event.data) {
                  const eventData = event.data as {
                    sessionId?: string;
                    state?: FlowState;
                  };
                  if (eventData?.sessionId) {
                    sessionIdRef.current = eventData.sessionId;
                  }
                  // Note: Full state update is now handled in handleEvent above
                }
              } catch (e) {
                // Silently handle parsing errors
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          // Check if it's an API key missing error and translate it
          let errorMessage = err.message;
          if (
            err.message.includes("API_KEY_MISSING") ||
            err.message.includes("API key not configured")
          ) {
            errorMessage = `${t("aiApiKeyMissing")}: ${t(
              "aiApiKeyMissingMessage"
            )}`;
          }
          setError(errorMessage);
          setState((prev) => {
            if (prev) {
              const updated: FlowState = {
                ...prev,
                status: "error" as FlowStatus,
                error: errorMessage,
              };
              updateState(updated);
              return updated;
            }
            return prev;
          });
        }
      }
    },
    [flowId, continueOnFailure, handleEvent, updateState, t]
  );

  const controlFlow = useCallback(
    async (
      action: "pause" | "resume" | "confirm" | "reject" | "restart",
      data?: unknown,
      operationAction?: string
    ): Promise<FlowState | null> => {
      if (!sessionIdRef.current) {
        throw new Error("No active session");
      }

      try {
        const response = await fetch("/api/flow/control", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            action,
            data,
            operationAction,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Flow control failed");
        }

        const { state: newState } = await response.json();
        if (newState) {
          updateState(newState);
          return newState;
        }
        return null;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err; // Re-throw so extend can handle it
      }
    },
    [updateState]
  );

  const pause = useCallback(async () => {
    await controlFlow("pause");
  }, [controlFlow]);
  const resume = useCallback(async () => {
    await controlFlow("resume");
  }, [controlFlow]);
  const confirm = useCallback(
    async (data?: unknown) => {
      // Confirm: calls controlFlow to move to next node, then automatically resume execution
      await controlFlow("confirm", data);

      // After confirm, automatically resume execution by calling execute API with sessionId
      if (sessionIdRef.current) {
        // Resume execution by calling /api/flow/execute with sessionId
        // This will resume from the current step (which was moved forward by confirm)
        abortControllerRef.current = new AbortController();
        setError(null);

        try {
          const response = await fetch("/api/flow/execute", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              flowId,
              input: {}, // Empty input - will use context from flow
              sessionId: sessionIdRef.current,
              aiConfig: aiConfig
                ? {
                    provider: aiConfig.provider,
                    apiUrl: aiConfig.apiUrl,
                    model: aiConfig.model,
                  }
                : undefined,
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.message || errorData.error || "Flow execution failed"
            );
          }

          // Handle streaming response
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error("No response body");
          }

          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const event: FlowEvent = JSON.parse(line.slice(6));
                  handleEvent(event);

                  // Extract session ID from state if available in event
                  if (event.type === "status-change" && event.data) {
                    const eventData = event.data as {
                      sessionId?: string;
                      state?: FlowState;
                    };
                    if (eventData?.sessionId) {
                      sessionIdRef.current = eventData.sessionId;
                    }
                    if (eventData?.state) {
                      updateState(eventData.state);
                    }
                  }
                } catch (e) {
                  // Silently handle parsing errors
                }
              }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name !== "AbortError") {
            const errorMessage = err.message;
            setError(errorMessage);
            setState((prev) => {
              if (prev) {
                const updated: FlowState = {
                  ...prev,
                  status: "error" as FlowStatus,
                  error: errorMessage,
                };
                updateState(updated);
                return updated;
              }
              return prev;
            });
          }
        }
      }
    },
    [controlFlow, flowId, aiConfig, handleEvent, updateState]
  );
  const reject = useCallback(async () => {
    await controlFlow("reject");
  }, [controlFlow]);
  const restart = useCallback(
    async (data?: unknown, operationAction?: string) => {
      // Restart: calls controlFlow with restart action, which will move currentStepIndex back
      // Then automatically resume execution with the same session
      await controlFlow("restart", data, operationAction);

      // After restart, automatically resume execution by calling execute API with sessionId
      if (sessionIdRef.current) {
        // Resume execution by calling /api/flow/execute with sessionId (no input needed)
        // This will resume from the current step (which was moved back by restart)
        abortControllerRef.current = new AbortController();
        setError(null);

        try {
          const response = await fetch("/api/flow/execute", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              flowId,
              input: {}, // Empty input - will use context from flow
              sessionId: sessionIdRef.current,
              aiConfig: aiConfig
                ? {
                    provider: aiConfig.provider,
                    apiUrl: aiConfig.apiUrl,
                    model: aiConfig.model,
                  }
                : undefined,
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.message || errorData.error || "Flow execution failed"
            );
          }

          // Handle streaming response
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error("No response body");
          }

          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const event: FlowEvent = JSON.parse(line.slice(6));
                  handleEvent(event);

                  // Extract session ID from state if available in event
                  if (event.type === "status-change" && event.data) {
                    const eventData = event.data as {
                      sessionId?: string;
                      state?: FlowState;
                    };
                    if (eventData?.sessionId) {
                      sessionIdRef.current = eventData.sessionId;
                    }
                    if (eventData?.state) {
                      updateState(eventData.state);
                    }
                  }
                } catch (e) {
                  // Silently handle parsing errors
                }
              }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name !== "AbortError") {
            const errorMessage = err.message;
            setError(errorMessage);
            setState((prev) => {
              if (prev) {
                const updated: FlowState = {
                  ...prev,
                  status: "error" as FlowStatus,
                  error: errorMessage,
                };
                updateState(updated);
                return updated;
              }
              return prev;
            });
          }
        }
      }
    },
    [controlFlow, flowId, aiConfig, handleEvent, updateState]
  );

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(null);
    setEvents([]);
    setError(null);
    sessionIdRef.current = null;
  }, []);

  // Update session ID from state
  useEffect(() => {
    if (state?.sessionId) {
      sessionIdRef.current = state.sessionId;
    }
  }, [state?.sessionId]);

  return {
    state,
    status: state?.status || "idle",
    error,
    isRunning: state?.status === "running",
    isPaused: state?.status === "paused",
    isWaitingConfirmation: state?.status === "waiting-operation",
    currentStep: state?.currentStepIndex ?? -1,
    events,
    execute,
    pause,
    resume,
    confirm,
    reject,
    restart,
    extend: restart, // Keep extend alias for backward compatibility
    reset,
  };
}
