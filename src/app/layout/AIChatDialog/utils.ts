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
 * Formats output value to string representation
 */
export function formatOutput(output: unknown): string {
  return typeof output === "string"
    ? output
    : JSON.stringify(output, null, 2);
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

/**
 * Checks if a message content indicates it's a step-start message
 */
export function isStepStartMessage(content: string): boolean {
  return content.includes("🔄");
}

