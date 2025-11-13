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

      // Execute node
      const result = await step.node.execute(state.context);

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

      // Check if confirmation is required
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
  action: "pause" | "resume" | "confirm" | "reject" | "skip" | "retry",
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
        // User confirmed, proceed to next step
        state.currentStepIndex++;
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
