/**
 * Server-side flow execution service
 * Handles flow execution with streaming, pause/resume, and user confirmations
 */

import type {
  FlowConfig,
  FlowState,
  FlowStatus,
  NodeContext,
  NodeResult,
  FlowEvent,
  LLMNode,
} from "./types";
import { Flow } from "./flow";

/**
 * Flow session manager for server-side execution
 */
class FlowSessionManager {
  private sessions = new Map<string, FlowSession>();

  createSession(flow: Flow, context: NodeContext): string {
    const sessionId = this.generateSessionId();
    const session: FlowSession = {
      id: sessionId,
      flow,
      context,
      status: "idle",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      nodeRetryCount: new Map<string, number>(),
    };
    this.sessions.set(sessionId, session);
    return sessionId;
  }

  getSession(sessionId: string): FlowSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<FlowSession>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.lastActivity = Date.now();
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private generateSessionId(): string {
    return `flow_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  // Cleanup old sessions (older than 1 hour)
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, session] of this.sessions.entries()) {
      if (session.lastActivity < oneHourAgo) {
        this.sessions.delete(id);
      }
    }
  }
}

interface FlowSession {
  id: string;
  flow: Flow;
  context: NodeContext;
  status: FlowStatus;
  createdAt: number;
  lastActivity: number;
  waitingForConfirmation?: {
    stepIndex: number;
    nodeId: string;
    result: NodeResult;
  };
  nodeRetryCount?: Map<string, number>; // Track retry count per node
}

const sessionManager = new FlowSessionManager();

// Cleanup every 30 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => sessionManager.cleanup(), 30 * 60 * 1000);
}

/**
 * Execute LLM node with streaming support
 * Returns an async generator that yields chunks and the final result
 */
async function* executeLLMNodeWithStreaming(
  node: LLMNode,
  context: NodeContext
): AsyncGenerator<{ type: "chunk" | "result"; data: string | NodeResult }> {
  try {
    const provider = node.config.provider || "deepseek";
    const input = context.input;
    const previousOutput = context.previousOutput;

    // Import LLM node helpers
    const { prepareMessages, parseResponse } = await import("./llm-node");

    // Transform input to message structure
    const messages = await prepareMessages(
      input,
      node.config.userPromptTemplate,
      node.config.systemPrompt,
      node.config.responseFormat,
      previousOutput,
      context
    );

    // Call LLM API with streaming
    let fullResponse = "";
    for await (const chunk of callLLMAPIStreaming({
      provider,
      apiKey: node.config.apiKey,
      apiUrl: node.config.apiUrl,
      model: node.config.model,
      messages,
      temperature: node.config.temperature,
      maxTokens: node.config.maxTokens,
      responseFormat: node.config.responseFormat,
    })) {
      fullResponse += chunk;
      yield { type: "chunk", data: chunk };
    }

    // Parse final response
    const output = await parseResponse(fullResponse, node.config.responseFormat);

    const result: NodeResult = {
      success: true,
      output,
      metadata: {
        nodeType: "llm",
        nodeId: node.id,
        provider,
        model: node.config.model,
      },
    };
    
    yield { type: "result", data: result };
  } catch (error) {
    const result: NodeResult = {
      success: false,
      output: context.input,
      error: error instanceof Error ? error.message : "Unknown error",
      metadata: { nodeType: "llm", nodeId: node.id },
    };
    yield { type: "result", data: result };
  }
}

/**
 * Call LLM API with streaming support and batch chunks with 1s interval
 * Returns an async generator that yields chunks
 */
async function* callLLMAPIStreaming(
  request: {
    provider: string;
    apiKey?: string;
    apiUrl?: string;
    model?: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: string;
  }
): AsyncGenerator<string> {
  const { provider, apiKey, apiUrl, model, messages, temperature, maxTokens, responseFormat } = request;

  // Default API URLs
  const apiUrls: Record<string, string> = {
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    openai: "https://api.openai.com/v1/chat/completions",
    anthropic: "https://api.anthropic.com/v1/messages",
    custom: apiUrl || "",
  };

  const url = apiUrl || apiUrls[provider];
  if (!url) {
    throw new Error(`No API URL configured for provider: ${provider}`);
  }

  // Prepare request body based on provider
  let body: Record<string, unknown>;

  if (provider === "anthropic") {
    body = {
      model: model || "claude-3-5-sonnet-20241022",
      max_tokens: maxTokens || 4096,
      messages,
      ...(temperature !== undefined && { temperature }),
      stream: true, // Enable streaming
    };
  } else {
    body = {
      model: model || (provider === "deepseek" ? "deepseek-chat" : "gpt-4"),
      messages,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { max_tokens: maxTokens }),
      ...(responseFormat === "json" && {
        response_format: { type: "json_object" },
      }),
      stream: true, // Enable streaming
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    if (provider === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} ${errorText}`);
  }

  // Handle streaming response
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming not supported");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            let content = "";

            if (provider === "anthropic") {
              content = parsed.delta?.text || "";
            } else {
              content = parsed.choices?.[0]?.delta?.content || "";
            }

            if (content) {
              fullContent += content;
              // Yield chunks immediately for real-time streaming
              yield content;
            }
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  // Return full content
  return fullContent;
}

/**
 * Execute flow with streaming support
 */
export async function* executeFlowStream(
  flowConfig: FlowConfig,
  initialContext: NodeContext,
  onEvent?: (event: FlowEvent) => void
): AsyncGenerator<FlowEvent, FlowState, unknown> {
  const flow = new Flow(flowConfig, initialContext);
  const sessionId = sessionManager.createSession(flow, initialContext);

  const state = flow.getState();
  state.sessionId = sessionId;

  try {
    // Emit initial status with session ID
    const initialEvent: FlowEvent = {
      type: "status-change",
      flowId: flowConfig.id,
      status: "running",
      data: { sessionId, state },
    };
    yield initialEvent;
    onEvent?.(initialEvent);

    sessionManager.updateSession(sessionId, { status: "running" });

      // Execute flow step by step
      while (state.status === "running" || state.status === "idle") {
        const step = state.steps[state.currentStepIndex];

        if (!step) {
          state.status = "completed";
          break;
        }

        // Check if this node requires confirmation
        const requiresConfirmation = flowConfig.confirmationNodes?.includes(
          step.nodeId
        );

      // Emit step start with state
      const stepStartEvent: FlowEvent = {
        type: "step-start",
        flowId: flowConfig.id,
        stepIndex: state.currentStepIndex,
        nodeId: step.nodeId,
        data: { sessionId, state },
      };
      yield stepStartEvent;
      onEvent?.(stepStartEvent);

      // Execute node with streaming support for LLM nodes
      let result: NodeResult;
      if (step.node.nodeType === "llm") {
        // Execute LLM node with streaming - yield chunks immediately
        let finalResult: NodeResult | null = null;

        // Stream chunks and yield them immediately
        for await (const item of executeLLMNodeWithStreaming(step.node, state.context)) {
          if (item.type === "chunk") {
            // Yield stream-chunk events immediately for real-time streaming
            const streamEvent: FlowEvent = {
              type: "stream-chunk",
              flowId: flowConfig.id,
              stepIndex: state.currentStepIndex,
              nodeId: step.nodeId,
              data: item.data as string,
            };
            yield streamEvent;
            onEvent?.(streamEvent);
          } else if (item.type === "result") {
            finalResult = item.data as NodeResult;
          }
        }

        if (!finalResult) {
          throw new Error("Streaming completed but no result received");
        }
        result = finalResult;
      } else {
        // Execute non-LLM nodes normally
        result = await step.node.execute(state.context);
      }

      step.result = result;
      step.executed = true;
      step.timestamp = Date.now();

      // Update context
      state.context.previousOutput = result.output;
      state.context.input = result.output;

      // Handle failure
      if (!result.success) {
        const errorEvent: FlowEvent = {
          type: "step-error",
          flowId: flowConfig.id,
          stepIndex: state.currentStepIndex,
          nodeId: step.nodeId,
          error: result.error,
        };
        yield errorEvent;
        onEvent?.(errorEvent);

        // Check if we should continue on failure
        if (flowConfig.continueOnFailure) {
          // Continue with input as output
          state.context.input =
            state.context.previousOutput || state.context.input;
        } else {
          // Check conditions for retry
          const condition = flowConfig.conditions?.find(
            (c) => c.nodeId === step.nodeId
          );
          if (condition && !condition.condition(result)) {
            const nextNodeId = condition.onFalse;
            const nextIndex = state.steps.findIndex(
              (s) => s.nodeId === nextNodeId
            );
            if (nextIndex !== -1) {
              state.currentStepIndex = nextIndex;
              continue;
            }
          }

          state.status = "error";
          state.error = result.error || "Node execution failed";
          break;
        }
      }

      // Emit step complete with updated state
      const stepCompleteEvent: FlowEvent = {
        type: "step-complete",
        flowId: flowConfig.id,
        stepIndex: state.currentStepIndex,
        nodeId: step.nodeId,
        data: { output: result.output, state },
      };
      yield stepCompleteEvent;
      onEvent?.(stepCompleteEvent);
      
      // Also emit status-change to update UI with current state
      const statusUpdateEvent: FlowEvent = {
        type: "status-change",
        flowId: flowConfig.id,
        status: state.status,
        data: { sessionId, state },
      };
      yield statusUpdateEvent;
      onEvent?.(statusUpdateEvent);

      // For dialog-check: check validation first, then decide on confirmation or retry
      if (step.nodeId === "dialog-check") {
        const output = result.output as Record<string, unknown>;
        const isValid = 
          output.valid === true ||
          output.isValid === true ||
          output.is_valid === true;

        if (!isValid) {
          // Invalid: go back to dialog-generation (with retry limit check)
          const dialogGenIndex = state.steps.findIndex((s) => s.nodeId === "dialog-generation");
          if (dialogGenIndex === -1) {
            state.status = "error";
            state.error = "Dialog generation node not found";
            break;
          }

          // Check retry count
          const session = sessionManager.getSession(sessionId);
          if (session) {
            const retryCount = (session.nodeRetryCount?.get("dialog-generation") || 0) + 1;
            session.nodeRetryCount?.set("dialog-generation", retryCount);
            
            const maxRetries = 3;
            if (retryCount > maxRetries) {
              state.status = "error";
              state.error = `Maximum retry limit (${maxRetries}) exceeded for dialog generation`;
              break;
            }
          }

          // Reset dialog-generation step and go back
          const dialogGenStep = state.steps[dialogGenIndex];
          if (dialogGenStep) {
            dialogGenStep.executed = false;
            dialogGenStep.result = undefined;
          }
          state.currentStepIndex = dialogGenIndex;
          continue; // Continue to retry dialog generation
        } else {
          // Valid: require confirmation before proceeding
          if (requiresConfirmation) {
            state.status = "waiting-confirmation";
            sessionManager.updateSession(sessionId, {
              status: "waiting-confirmation",
              waitingForConfirmation: {
                stepIndex: state.currentStepIndex,
                nodeId: step.nodeId,
                result,
              },
            });

            const confirmEvent: FlowEvent = {
              type: "confirmation-required",
              flowId: flowConfig.id,
              stepIndex: state.currentStepIndex,
              nodeId: step.nodeId,
              data: result.output,
            };
            yield confirmEvent;
            onEvent?.(confirmEvent);
            break; // Wait for user confirmation
          }
        }
      } else {
        // For other nodes: check if confirmation is required
        if (requiresConfirmation) {
          state.status = "waiting-confirmation";
          sessionManager.updateSession(sessionId, {
            status: "waiting-confirmation",
            waitingForConfirmation: {
              stepIndex: state.currentStepIndex,
              nodeId: step.nodeId,
              result,
            },
          });

          const confirmEvent: FlowEvent = {
            type: "confirmation-required",
            flowId: flowConfig.id,
            stepIndex: state.currentStepIndex,
            nodeId: step.nodeId,
            data: result.output,
          };
          yield confirmEvent;
          onEvent?.(confirmEvent);
          break; // Wait for user confirmation
        }
      }

      // Determine next node
      const nextNodeId = getNextNodeId(flowConfig, step.nodeId, result, state);

      if (nextNodeId === null) {
        state.status = "completed";
        break;
      }

      const nextIndex = state.steps.findIndex((s) => s.nodeId === nextNodeId);
      if (nextIndex === -1) {
        state.status = "error";
        state.error = `Next node not found: ${nextNodeId}`;
        break;
      }

      // Check if we're going back to a previous node (retry scenario)
      const session = sessionManager.getSession(sessionId);
      if (session && nextIndex < state.currentStepIndex) {
        // We're going backwards, increment retry count
        const retryCount = (session.nodeRetryCount?.get(nextNodeId) || 0) + 1;
        session.nodeRetryCount?.set(nextNodeId, retryCount);
        
        const maxRetries = 3; // Maximum number of retries per node
        if (retryCount > maxRetries) {
          state.status = "error";
          state.error = `Maximum retry limit (${maxRetries}) exceeded for node: ${nextNodeId}`;
          break;
        }
      } else if (session && nextIndex > state.currentStepIndex) {
        // Moving forward, reset retry count for the next node
        session.nodeRetryCount?.set(nextNodeId, 0);
      }

      state.currentStepIndex = nextIndex;
    }

    // Emit final status with state
    const finalEvent: FlowEvent = {
      type: "status-change",
      flowId: flowConfig.id,
      status: state.status,
      data: { sessionId, state },
    };
    yield finalEvent;
    onEvent?.(finalEvent);

    sessionManager.updateSession(sessionId, { status: state.status });

    return state;
  } catch (error) {
    state.status = "error";
    state.error = error instanceof Error ? error.message : "Unknown error";

    const errorEvent: FlowEvent = {
      type: "step-error",
      flowId: flowConfig.id,
      error: state.error,
    };
    yield errorEvent;
    onEvent?.(errorEvent);

    sessionManager.updateSession(sessionId, { status: "error" });
    return state;
  }
}

/**
 * Control flow execution (pause, resume, confirm, etc.)
 */
export async function controlFlow(
  sessionId: string,
  action: "pause" | "resume" | "confirm" | "reject" | "skip" | "retry" | "extend",
  data?: unknown
): Promise<FlowState> {
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const flow = session.flow;
  const state = flow.getState();

  switch (action) {
    case "pause":
      flow.pause();
      sessionManager.updateSession(sessionId, { status: "paused" });
      break;

    case "resume":
      if (
        state.status === "paused" ||
        state.status === "waiting-confirmation"
      ) {
        flow.resume();
        sessionManager.updateSession(sessionId, { status: "running" });
        // Continue execution
        await continueFlowExecution(sessionId);
      }
      break;

    case "confirm":
      if (
        state.status === "waiting-confirmation" &&
        session.waitingForConfirmation
      ) {
        // User confirmed, proceed to next step (dialog-audio for dialog-check)
        const currentNodeId = session.waitingForConfirmation.nodeId;
        if (currentNodeId === "dialog-check") {
          // Find dialog-audio node
          const dialogAudioIndex = state.steps.findIndex((s) => s.nodeId === "dialog-audio");
          if (dialogAudioIndex !== -1) {
            state.currentStepIndex = dialogAudioIndex;
          } else {
            state.currentStepIndex++;
          }
        } else {
          state.currentStepIndex++;
        }
        state.status = "running";
        sessionManager.updateSession(sessionId, {
          status: "running",
          waitingForConfirmation: undefined,
        });
        // Continue execution
        await continueFlowExecution(sessionId);
      }
      break;

    case "reject":
      if (state.status === "waiting-confirmation") {
        // User rejected, go back or stop
        state.status = "error";
        state.error = "User rejected the result";
        sessionManager.updateSession(sessionId, {
          status: "error",
          waitingForConfirmation: undefined,
        });
      }
      break;

    case "skip":
      if (state.status === "waiting-confirmation") {
        // Skip confirmation, proceed
        state.currentStepIndex++;
        state.status = "running";
        sessionManager.updateSession(sessionId, {
          status: "running",
          waitingForConfirmation: undefined,
        });
        await continueFlowExecution(sessionId);
      }
      break;

    case "retry":
      if (state.status === "error" || state.status === "waiting-confirmation") {
        // Retry current step
        const currentStep = state.steps[state.currentStepIndex];
        if (currentStep) {
          currentStep.executed = false;
          currentStep.result = undefined;
        }
        state.status = "running";
        sessionManager.updateSession(sessionId, {
          status: "running",
          waitingForConfirmation: undefined,
        });
        await continueFlowExecution(sessionId);
      }
      break;

    case "extend":
      if (state.status === "waiting-confirmation" && session.waitingForConfirmation) {
        // User wants to extend the dialog
        // Find dialog-generation node index
        const dialogGenIndex = state.steps.findIndex((s) => s.nodeId === "dialog-generation");
        if (dialogGenIndex === -1) {
          state.status = "error";
          state.error = "Dialog generation node not found";
          sessionManager.updateSession(sessionId, {
            status: "error",
            waitingForConfirmation: undefined,
          });
          break;
        }

        // Get the actual dialog from dialog-generation step (not from dialog-check)
        const dialogGenStep = state.steps[dialogGenIndex];
        const currentDialogResult = dialogGenStep?.result?.output;
        const userExtensionInput = data as string | undefined;

        if (!currentDialogResult) {
          state.status = "error";
          state.error = "No dialog found to extend";
          sessionManager.updateSession(sessionId, {
            status: "error",
            waitingForConfirmation: undefined,
          });
          break;
        }

        // Get original analysis from dialog-analysis step to preserve context
        const dialogAnalysisIndex = state.steps.findIndex((s) => s.nodeId === "dialog-analysis");
        const originalAnalysis = dialogAnalysisIndex !== -1 
          ? state.steps[dialogAnalysisIndex]?.result?.output 
          : null;

        // Combine current dialog with user's extension input and original analysis
        // Update context to pass all info to dialog-generation
        const extendedInput = {
          previousDialog: currentDialogResult,
          extensionRequest: userExtensionInput || "Please extend this dialog",
          ...(originalAnalysis ? { originalAnalysis } : {}),
        };

        // Reset dialog-generation step
        if (dialogGenStep) {
          dialogGenStep.executed = false;
          dialogGenStep.result = undefined;
        }

        // Update context with extended input
        flow.updateContext({ input: extendedInput });

        // Go back to dialog-generation
        state.currentStepIndex = dialogGenIndex;
        state.status = "running";
        sessionManager.updateSession(sessionId, {
          status: "running",
          waitingForConfirmation: undefined,
        });
        await continueFlowExecution(sessionId);
      }
      break;
  }

  return flow.getState();
}

/**
 * Continue flow execution after pause/resume/confirm
 */
async function continueFlowExecution(sessionId: string): Promise<void> {
  const session = sessionManager.getSession(sessionId);
  if (!session) return;

  const flow = session.flow;
  const state = flow.getState();

  // Continue from current step
  if (state.currentStepIndex < state.steps.length) {
    const step = state.steps[state.currentStepIndex];
    const result = await step.node.execute(state.context);

    step.result = result;
    step.executed = true;
    step.timestamp = Date.now();

    state.context.previousOutput = result.output;
    state.context.input = result.output;

    if (!result.success) {
      state.status = "error";
      state.error = result.error || "Node execution failed";
      sessionManager.updateSession(sessionId, { status: "error" });
      return;
    }

    // Determine next step
    const nextNodeId = getNextNodeId(state.config, step.nodeId, result, state);
    if (nextNodeId === null) {
      state.status = "completed";
    } else {
      const nextIndex = state.steps.findIndex((s) => s.nodeId === nextNodeId);
      if (nextIndex !== -1) {
        state.currentStepIndex = nextIndex;
      } else {
        state.status = "completed";
      }
    }

    sessionManager.updateSession(sessionId, { status: state.status });
  } else {
    state.status = "completed";
    sessionManager.updateSession(sessionId, { status: "completed" });
  }
}

/**
 * Get flow state
 */
export function getFlowState(sessionId: string): FlowState | null {
  const session = sessionManager.getSession(sessionId);
  if (!session) return null;
  return session.flow.getState();
}

/**
 * Helper to get next node ID
 */
function getNextNodeId(
  config: FlowConfig,
  currentNodeId: string,
  result: NodeResult,
  state: FlowState
): string | null {
  if (config.defaultNext) {
    const customNext = config.defaultNext(currentNodeId);
    if (customNext !== null) return customNext;
  }

  const condition = config.conditions?.find((c) => c.nodeId === currentNodeId);
  if (condition) {
    return condition.condition(result) ? condition.onTrue : condition.onFalse;
  }

  const currentIndex = state.steps.findIndex((s) => s.nodeId === currentNodeId);
  if (currentIndex === -1 || currentIndex >= state.steps.length - 1) {
    return null;
  }

  return state.steps[currentIndex + 1].nodeId;
}
