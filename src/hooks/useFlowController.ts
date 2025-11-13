/**
 * Client-side hook for controlling flow execution
 * Handles streaming, state management, and user interactions
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  FlowState,
  FlowEvent,
  FlowStatus,
  FlowExecutionRequest,
} from '@/lib/lm-ai/types';
import { useAppStore } from '@/store/useAppStore';

interface UseFlowControllerOptions {
  flowId: string;
  onEvent?: (event: FlowEvent) => void;
  onStateChange?: (state: FlowState) => void;
  confirmationNodes?: string[];
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
  skip: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

export function useFlowController(
  options: UseFlowControllerOptions
): UseFlowControllerReturn {
  const {
    flowId,
    onEvent,
    onStateChange,
    confirmationNodes,
    continueOnFailure,
  } = options;

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
      if (event.type === 'status-change' && event.status) {
        setState((prev) => {
          if (prev) {
            const updated: FlowState = { ...prev, status: event.status as FlowStatus };
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
          confirmationNodes,
          continueOnFailure,
          // Note: apiKey is now stored in HTTP-only cookie, not sent in request body
          aiConfig: aiConfig ? {
            provider: aiConfig.provider,
            // Don't send apiKey - it's read from HTTP-only cookie on server
            apiUrl: aiConfig.apiUrl,
            model: aiConfig.model,
          } : undefined,
        };

        const response = await fetch('/api/flow/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Flow execution failed');
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: FlowEvent = JSON.parse(line.slice(6));
                
                // Extract session ID from first event
                if (!sessionIdRef.current && event.flowId) {
                  // Session ID will be in the state, we'll get it from status endpoint
                }

                handleEvent(event);

                // Extract session ID from state if available in event
                if (event.type === 'status-change' && event.data) {
                  const eventData = event.data as { sessionId?: string; state?: FlowState };
                  if (eventData?.sessionId) {
                    sessionIdRef.current = eventData.sessionId;
                  }
                  if (eventData?.state) {
                    updateState(eventData.state);
                  }
                }
              } catch (e) {
                console.error('Error parsing event:', e);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
          setState((prev) => {
            if (prev) {
              const updated: FlowState = { ...prev, status: 'error' as FlowStatus, error: err.message };
              updateState(updated);
              return updated;
            }
            return prev;
          });
        }
      }
    },
    [flowId, confirmationNodes, continueOnFailure, handleEvent, updateState]
  );

  const controlFlow = useCallback(
    async (action: 'pause' | 'resume' | 'confirm' | 'reject' | 'skip' | 'retry', data?: unknown) => {
      if (!sessionIdRef.current) {
        throw new Error('No active session');
      }

      try {
        const response = await fetch('/api/flow/control', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            action,
            data,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Flow control failed');
        }

        const { state: newState } = await response.json();
        if (newState) {
          updateState(newState);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    },
    [updateState]
  );

  const pause = useCallback(() => controlFlow('pause'), [controlFlow]);
  const resume = useCallback(() => controlFlow('resume'), [controlFlow]);
  const confirm = useCallback((data?: unknown) => controlFlow('confirm', data), [controlFlow]);
  const reject = useCallback(() => controlFlow('reject'), [controlFlow]);
  const skip = useCallback(() => controlFlow('skip'), [controlFlow]);
  const retry = useCallback(() => controlFlow('retry'), [controlFlow]);

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
    status: state?.status || 'idle',
    error,
    isRunning: state?.status === 'running',
    isPaused: state?.status === 'paused',
    isWaitingConfirmation: state?.status === 'waiting-confirmation',
    currentStep: state?.currentStepIndex ?? -1,
    events,
    execute,
    pause,
    resume,
    confirm,
    reject,
    skip,
    retry,
    reset,
  };
}

