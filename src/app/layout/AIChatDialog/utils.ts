import type { FlowState } from "@/lib/lm-ai/types";

/**
 * Creates a unique ID using crypto.randomUUID() or fallback to random string
 */
export function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/**
 * Gets the node name from flow state by nodeId
 */
export function getNodeName(
  nodeId?: string,
  state?: FlowState | null
): string {
  if (nodeId && state?.steps) {
    const step = state.steps.find((s) => s.nodeId === nodeId);
    if (step) return step.node.name;
  }
  return nodeId || "Node";
}

/**
 * Checks if a node should show its response in the dialog
 */
export function shouldShowNodeResponse(
  nodeId?: string,
  state?: FlowState | null
): boolean {
  // If state is not available yet (e.g., during step-start), default to showing
  if (!state?.steps) {
    return true;
  }
  
  if (nodeId) {
    const step = state.steps.find((s) => s.nodeId === nodeId);
    if (step && step.node) {
      // Check if node has showResponse flag set
      // Default to true for LLM nodes if not explicitly set to false
      if (step.node.nodeType === 'llm') {
        return step.node.showResponse !== false;
      }
      return step.node.showResponse === true;
    }
  }
  // Default: show response for workflow messages (except chat flow)
  // This ensures content is visible unless explicitly hidden
  return true;
}

/**
 * Formats output value to string representation
 */
export function formatOutput(output: unknown): string {
  if (output === null || output === undefined) {
    return "";
  }
  if (typeof output === "string") {
    return output;
  }
  // For objects/arrays, format as JSON with indentation for readability
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

/**
 * Parses workflow input based on action type
 */
export function parseWorkflowInput(
  action: string,
  userMessage: string
): unknown {
  if (action === "simulate-dialog") {
    try {
      return JSON.parse(userMessage);
    } catch {
      // If not JSON, create a simple structure
      return {
        situation: userMessage,
        characterA: "Character A",
        characterB: "Character B",
        notes: "",
      };
    }
  }
  return userMessage;
}

/**
 * Extracts final output from flow state and formats it
 */
export function extractFinalOutput(
  state: FlowState
): string | null {
  const finalOutput = state.context.previousOutput;
  if (!finalOutput) return null;
  return formatOutput(finalOutput);
}

