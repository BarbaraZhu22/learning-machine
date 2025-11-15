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
  NodeOperation,
  NodeOperationHandler,
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

  // Cleanup a specific session immediately
  // Called when workflow completes, errors, or is rejected
  // No interval cleanup needed - sessions are cleaned up immediately when finished
  cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

interface FlowSession {
  id: string;
  flow: Flow;
  context: NodeContext;
  status: FlowStatus;
  createdAt: number;
  lastActivity: number;
  waitingForOperation?: {
    stepIndex: number;
    nodeId: string;
    result: NodeResult;
    operations: NodeOperation[];
  };
  nodeRetryCount?: Map<string, number>; // Track retry count per node for validation checks
}

const sessionManager = new FlowSessionManager();

/**
 * Get the session manager instance
 * Used by API routes to manage sessions
 */
export function getSessionManager(): FlowSessionManager {
  return sessionManager;
}

// No interval cleanup needed - sessions are cleaned up immediately when:
// 1. Workflow completes (status = "completed")
// 2. Workflow errors (status = "error") 
// 3. User rejects (status = "error")
// This is simpler and prevents any cleanup issues during active workflows

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
 * Resume flow execution from an existing session
 */
export async function* resumeFlowStream(
  sessionId: string,
  onEvent?: (event: FlowEvent) => void
): AsyncGenerator<FlowEvent, FlowState, unknown> {
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Update lastActivity to keep session alive
  sessionManager.updateSession(sessionId, { lastActivity: Date.now() });

  const flow = session.flow;
  // Always get fresh state from flow to ensure we have the latest currentStepIndex
  const state = flow.getState();

  // Continue execution from current step
  return yield* continueFlowExecutionStream(state, sessionId, onEvent);
}

/**
 * Continue flow execution stream from current state
 */
async function* continueFlowExecutionStream(
  state: FlowState,
  sessionId: string,
  onEvent?: (event: FlowEvent) => void
): AsyncGenerator<FlowEvent, FlowState, unknown> {
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const flow = session.flow;
  const flowConfig = state.config;

  try {
    // Always get fresh state from flow at the start to ensure we have the latest currentStepIndex
    // This is important because the state parameter might be stale
    let currentState = flow.getState();
    
    // Emit status change to indicate resuming
    const resumeEvent: FlowEvent = {
      type: "status-change",
      flowId: flowConfig.id,
      status: "running",
      data: { sessionId, state: currentState },
    };
    yield resumeEvent;
    onEvent?.(resumeEvent);

    sessionManager.updateSession(sessionId, { status: "running" });

    // Execute flow step by step
    // Always get fresh state from flow in each iteration to ensure we're using the latest state
    while (currentState.status === "running" || currentState.status === "idle") {
      // Update lastActivity periodically to keep session alive during execution
      sessionManager.updateSession(sessionId, { lastActivity: Date.now() });
      
      // Get fresh state from flow to ensure we have the latest currentStepIndex
      currentState = flow.getState();
      const step = currentState.steps[currentState.currentStepIndex];

      if (!step) {
        currentState.status = "completed";
        flow.setStatus("completed");
        break;
      }

      // Operations are checked after node execution, not before

      // Emit step start with state
      const stepStartEvent: FlowEvent = {
        type: "step-start",
        flowId: flowConfig.id,
        stepIndex: currentState.currentStepIndex,
        nodeId: step.nodeId,
        data: { sessionId, state: currentState },
      };
      yield stepStartEvent;
      onEvent?.(stepStartEvent);

      // Execute node with streaming support for LLM nodes
      let result: NodeResult;
      if (step.node.nodeType === "llm") {
        // Execute LLM node with streaming - yield chunks immediately
        let finalResult: NodeResult | null = null;

        // Stream chunks and yield them immediately
        for await (const item of executeLLMNodeWithStreaming(step.node, currentState.context)) {
          if (item.type === "chunk") {
            // Yield stream-chunk events immediately for real-time streaming
            const streamEvent: FlowEvent = {
              type: "stream-chunk",
              flowId: flowConfig.id,
              stepIndex: currentState.currentStepIndex,
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
        result = await step.node.execute(currentState.context);
      }

      step.result = result;
      step.executed = true;
      step.timestamp = Date.now();

      // Update context in flow
      currentState.context.previousOutput = result.output;
      currentState.context.input = result.output;
      flow.updateContext({
        previousOutput: result.output,
        input: result.output,
      });

      // Handle failure
      if (!result.success) {
        const errorEvent: FlowEvent = {
          type: "step-error",
          flowId: flowConfig.id,
          stepIndex: currentState.currentStepIndex,
          nodeId: step.nodeId,
          error: result.error,
        };
        yield errorEvent;
        onEvent?.(errorEvent);

        // Check if we should continue on failure
        if (flowConfig.continueOnFailure) {
          // Continue with input as output
          currentState.context.input =
            currentState.context.previousOutput || currentState.context.input;
          flow.updateContext({
            input: currentState.context.input,
          });
        } else {
          // Check conditions for retry
          const condition = flowConfig.conditions?.find(
            (c) => c.nodeId === step.nodeId
          );
          if (condition && !condition.condition(result)) {
            const nextNodeId = condition.onFalse;
            const nextIndex = currentState.steps.findIndex(
              (s) => s.nodeId === nextNodeId
            );
            if (nextIndex !== -1) {
              flow.setCurrentStepIndex(nextIndex);
              continue; // Will get fresh state on next iteration
            }
          }

          currentState.status = "error";
          currentState.error = result.error || "Node execution failed";
          flow.setStatus("error");
          break;
        }
      }

      // Get fresh state after context updates
      currentState = flow.getState();

      // Emit step complete with updated state
      const stepCompleteEvent: FlowEvent = {
        type: "step-complete",
        flowId: flowConfig.id,
        stepIndex: currentState.currentStepIndex,
        nodeId: step.nodeId,
        data: { output: result.output, state: currentState },
      };
      yield stepCompleteEvent;
      onEvent?.(stepCompleteEvent);

      // STEP 1: Check validation check (if result is invalid, retry up to maxRetries)
      const validationCheck = flowConfig.validationChecks?.find(
        (vc) => vc.nodeId === step.nodeId
      );
      
      if (validationCheck && !validationCheck.check(result)) {
        // Invalid: retry (go back to retryTargetNodeId or previous node)
        const retryTargetNodeId = validationCheck.retryTargetNodeId || 
          (currentState.currentStepIndex > 0 
            ? currentState.steps[currentState.currentStepIndex - 1].nodeId 
            : null);
        
        if (!retryTargetNodeId) {
          // No node to go back to
          currentState.status = "error";
          currentState.error = "Validation failed and no node to retry";
          flow.setStatus("error");
          break;
        }

        // Check retry count
        if (session) {
          const retryCount = (session.nodeRetryCount?.get(step.nodeId) || 0) + 1;
          session.nodeRetryCount?.set(step.nodeId, retryCount);
          
          const maxRetries = validationCheck.maxRetries || 3;
          if (retryCount > maxRetries) {
            // Out of retries: reject workflow
            currentState.status = "error";
            currentState.error = `Validation failed after ${maxRetries} retries`;
            flow.setStatus("error");
            break;
          }
        }

        // Go back to retry target node
        const retryIndex = currentState.steps.findIndex((s) => s.nodeId === retryTargetNodeId);
        if (retryIndex === -1) {
          currentState.status = "error";
          currentState.error = `Retry target node not found: ${retryTargetNodeId}`;
          flow.setStatus("error");
          break;
        }

        // Reset the retry target step
        const retryStep = currentState.steps[retryIndex];
        if (retryStep) {
          retryStep.executed = false;
          retryStep.result = undefined;
        }

        flow.setCurrentStepIndex(retryIndex);
        sessionManager.updateSession(sessionId, { status: "running" });
        continue; // Retry from the target node
      }

      // STEP 2: Check for operations (if node has operations, pause and wait for user)
      const nodeOperations = flowConfig.nodeOperations?.[step.nodeId];
      
      if (nodeOperations && nodeOperations.length > 0) {
        // Pause workflow and wait for user operation
        currentState.status = "waiting-operation";
        flow.setStatus("waiting-operation");
        sessionManager.updateSession(sessionId, {
          status: "waiting-operation",
          waitingForOperation: {
            stepIndex: currentState.currentStepIndex,
            nodeId: step.nodeId,
            result,
            operations: nodeOperations,
          },
        });

        const operationEvent: FlowEvent = {
          type: "operation-required",
          flowId: flowConfig.id,
          stepIndex: currentState.currentStepIndex,
          nodeId: step.nodeId,
          data: result.output,
          operations: nodeOperations,
        };
        yield operationEvent;
        onEvent?.(operationEvent);
        
        const statusEvent: FlowEvent = {
          type: "status-change",
          flowId: flowConfig.id,
          status: "waiting-operation",
          data: { sessionId, state: currentState },
        };
        yield statusEvent;
        onEvent?.(statusEvent);
        
        // Return and wait for user operation (confirm/reject/restart)
        return currentState;
      }

      // STEP 3: No validation check failed and no operations - continue to next node
      currentState = flow.getState();
      const nextNodeId = getNextNodeId(flowConfig, step.nodeId, result, currentState);

      if (nextNodeId === null) {
        currentState.status = "completed";
        flow.setStatus("completed");
        break;
      }

      const nextIndex = currentState.steps.findIndex((s) => s.nodeId === nextNodeId);
      if (nextIndex === -1) {
        currentState.status = "error";
        currentState.error = `Next node not found: ${nextNodeId}`;
        flow.setStatus("error");
        break;
      }

      // Reset retry count when moving forward
      if (session && nextIndex > currentState.currentStepIndex) {
        session.nodeRetryCount?.set(step.nodeId, 0);
      }

      flow.setCurrentStepIndex(nextIndex);
      // Will get fresh state on next iteration
    }

    // Get final state
    const finalState = flow.getState();

    // Emit final status with state
    const finalEvent: FlowEvent = {
      type: "status-change",
      flowId: flowConfig.id,
      status: finalState.status,
      data: { sessionId, state: finalState },
    };
    yield finalEvent;
    onEvent?.(finalEvent);

    // Update session status
    if (finalState.status !== "waiting-operation") {
      sessionManager.updateSession(sessionId, { status: finalState.status });
      
      // Clean up session immediately when workflow completes or errors
      // No need to keep completed/error sessions around
      // Cleanup happens after generator returns, so response is already sent to client
      if (finalState.status === "completed" || finalState.status === "error") {
        sessionManager.cleanupSession(sessionId);
      }
    }

    return finalState;
  } catch (error) {
    const errorState = flow.getState();
    errorState.status = "error";
    errorState.error = error instanceof Error ? error.message : "Unknown error";
    flow.setStatus("error");

    const errorEvent: FlowEvent = {
      type: "step-error",
      flowId: flowConfig.id,
      error: errorState.error,
    };
    yield errorEvent;
    onEvent?.(errorEvent);

    sessionManager.updateSession(sessionId, { status: "error" });
    
    // Clean up session immediately when workflow errors
    // Cleanup happens after generator returns, so error event is already sent to client
    sessionManager.cleanupSession(sessionId);
    
    return errorState;
  }
}

/**
 * Execute a flow from start or from a specific step
 * 
 * General workflow feature: Can start any workflow at any step
 * - If startIndex is provided, starts execution from that step (for extend/retry)
 * - If partialState is provided in initialContext._partialState, nodes can reference previous workflow
 * - The node at startIndex receives initialContext.input and can optionally use _partialState
 * 
 * This enables:
 * - Extend: Go back to a previous node with new input
 * - Retry: Retry from a previous node
 * - Future general API: `/api/back/workflow/node` that can start any workflow at any step
 */
export async function* executeFlowStream(
  flowConfig: FlowConfig,
  initialContext: NodeContext,
  onEvent?: (event: FlowEvent) => void,
  startIndex?: number
): AsyncGenerator<FlowEvent, FlowState, unknown> {
  const flow = new Flow(flowConfig, initialContext);
  const sessionId = sessionManager.createSession(flow, initialContext);

  const state = flow.getState();
  state.sessionId = sessionId;

  // If startIndex is provided, start execution from that step (general workflow feature)
  // This is used by extend, retry, or any action that needs to restart at a specific step
  if (startIndex !== undefined && startIndex >= 0 && startIndex < state.steps.length) {
    flow.setCurrentStepIndex(startIndex);
    state.currentStepIndex = startIndex;
  }

  // Emit initial status with session ID
  const initialEvent: FlowEvent = {
    type: "status-change",
    flowId: flowConfig.id,
    status: "running",
    data: { sessionId, state },
  };
  yield initialEvent;
  onEvent?.(initialEvent);

  sessionManager.updateSession(sessionId, { status: "running", lastActivity: Date.now() });

  // Use the shared execution logic
  return yield* continueFlowExecutionStream(state, sessionId, onEvent);
}


/**
 * Control flow execution (pause, resume, confirm, reject, restart)
 */
export async function controlFlow(
  sessionId: string,
  action: "pause" | "resume" | "confirm" | "reject" | "restart",
  data?: unknown,
  operationAction?: string
): Promise<FlowState> {
  // Get session - we should always have a sessionId from the client
  // One workflow = one session. If session doesn't exist, it was cleaned up or never created.
  let session = sessionManager.getSession(sessionId);
  
  if (!session) {
    // Session not found - may have been cleaned up
    // Note: Sessions waiting for operation or running should NEVER be cleaned up
    // If this happens, there might be a bug in cleanup logic
    throw new Error(
      `Session not found: ${sessionId}. The session may have been cleaned up. Please start a new workflow.`
    );
  }
  
  // CRITICAL: Update lastActivity IMMEDIATELY to prevent cleanup
  // This must happen before any other operations to ensure session stays alive
  // Also protects the session during restart/resume gap
  sessionManager.updateSession(sessionId, { lastActivity: Date.now() });
  
  // Re-fetch session after update to ensure we have latest state
  session = sessionManager.getSession(sessionId);
  if (!session) {
    // Should never happen, but double-check
    throw new Error(`Session ${sessionId} was deleted during operation`);
  }

  const flow = session.flow;
  let state = flow.getState();

  switch (action) {
    case "pause":
      flow.pause();
      sessionManager.updateSession(sessionId, { status: "paused" });
      break;

    case "resume":
      if (
        state.status === "paused" ||
        state.status === "waiting-operation"
      ) {
        flow.resume();
        sessionManager.updateSession(sessionId, { status: "running" });
        // Execution will be resumed by client via /api/flow/execute with sessionId
      }
      break;

    case "confirm":
      // Confirm: resume workflow to next node
      if (
        state.status === "waiting-operation" &&
        session.waitingForOperation &&
        (operationAction === "confirm" || !operationAction)
      ) {
        // Find next node using condition system
        const currentNodeId = session.waitingForOperation.nodeId;
        const result = session.waitingForOperation.result;
        
        // Get next node ID
        const nextNodeId = getNextNodeId(state.config, currentNodeId, result, state);
        
        if (nextNodeId === null) {
          // No next node - workflow completed
          flow.setStatus("completed");
          sessionManager.updateSession(sessionId, {
            status: "completed",
            waitingForOperation: undefined,
          });
          
          // Clean up session immediately when workflow completes
          // Cleanup happens after controlFlow returns, so state is already sent to client
          sessionManager.cleanupSession(sessionId);
        } else {
          const nextIndex = state.steps.findIndex((s) => s.nodeId === nextNodeId);
          if (nextIndex !== -1) {
            flow.setCurrentStepIndex(nextIndex);
            flow.setStatus("running");
            sessionManager.updateSession(sessionId, {
              status: "running",
              waitingForOperation: undefined,
            });
          } else {
            flow.setStatus("error");
            flow.setError(`Next node not found: ${nextNodeId}`);
            sessionManager.updateSession(sessionId, {
              status: "error",
              waitingForOperation: undefined,
            });
          }
        }
        state = flow.getState();
      }
      break;

    case "reject":
      // Reject: stop workflow with error
      if (state.status === "waiting-operation") {
        flow.setStatus("error");
        flow.setError("User rejected the result");
        sessionManager.updateSession(sessionId, {
          status: "error",
          waitingForOperation: undefined,
        });
        state = flow.getState();
        
        // Clean up session immediately when rejected
        // Cleanup happens after controlFlow returns, so state is already sent to client
        sessionManager.cleanupSession(sessionId);
      }
      break;

    case "restart":
      // Restart: go back to a certain node (don't close session & workflow)
      // Just move currentStepIndex back to that node, then continue from there
      if (
        state.status === "waiting-operation" &&
        session.waitingForOperation
      ) {
        const operation = session.waitingForOperation.operations.find(
          (op) => op.action === (operationAction || "restart")
        );

        if (!operation || !operation.handler) {
          flow.setStatus("error");
          flow.setError("Restart operation handler not found");
          sessionManager.updateSession(sessionId, {
            status: "error",
            waitingForOperation: undefined,
          });
          return flow.getState();
        }

        // Get user input for restart (e.g., extension request)
        const userInput = data as string | undefined;

        // Call handler to get target node ID
        const targetNodeId = operation.handler(session.waitingForOperation.result, userInput);

        if (!targetNodeId) {
          flow.setStatus("error");
          flow.setError("Restart handler returned no target node");
          sessionManager.updateSession(sessionId, {
            status: "error",
            waitingForOperation: undefined,
          });
          return flow.getState();
        }

        // Find target node index
        const targetIndex = state.steps.findIndex((s) => s.nodeId === targetNodeId);
        
        if (targetIndex === -1) {
          flow.setStatus("error");
          flow.setError(`Target node not found: ${targetNodeId}`);
          sessionManager.updateSession(sessionId, {
            status: "error",
            waitingForOperation: undefined,
          });
          return flow.getState();
        }

        // If user input provided, update context for the target node
        if (userInput && targetIndex < state.currentStepIndex) {
          // Going back - update context with user input
          // The target node will receive this input on next execution
          const currentNodeId = session.waitingForOperation.nodeId;
          
          // For dialog-check restart -> dialog-generation, prepare context
          if (targetNodeId === "dialog-generation" && currentNodeId === "dialog-check") {
            // Get previous dialog generation output
            const dialogGenStep = state.steps.find((s) => s.nodeId === "dialog-generation");
            const previousDialog = dialogGenStep?.result?.output;
            
            if (previousDialog) {
              // Update context for dialog-generation with extension input
              flow.updateContext({
                input: {
                  previousDialog,
                  extensionRequest: userInput,
                },
                previousOutput: previousDialog,
              });
            }
          }
        }

        // Reset the target step and move back to it
        const targetStep = state.steps[targetIndex];
        if (targetStep) {
          targetStep.executed = false;
          targetStep.result = undefined;
        }

        flow.setCurrentStepIndex(targetIndex);
        flow.setStatus("running");
        sessionManager.updateSession(sessionId, {
          status: "running",
          waitingForOperation: undefined,
        });

        // Execution will be resumed by client via /api/flow/execute with sessionId
        state = flow.getState();
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
 * Also updates lastActivity to keep session alive
 * CRITICAL: This is called by execute route to check if session exists before resuming
 * MUST update lastActivity to prevent cleanup
 */
export function getFlowState(sessionId: string): FlowState | null {
  const session = sessionManager.getSession(sessionId);
  if (!session) return null;
  // CRITICAL: Update lastActivity IMMEDIATELY to prevent cleanup
  // This is called when client tries to resume - must keep session alive
  sessionManager.updateSession(sessionId, { lastActivity: Date.now() });
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
