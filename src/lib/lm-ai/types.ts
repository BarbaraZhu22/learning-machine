/**
 * Type definitions for learning language agent nodes and flows
 */

export type PreNodeType =
  | 'format'
  | 'summarize'
  | 'organize'
  | 'transform-message'
  | 'validate-input'
  | 'validate-and-transform';

export type LLMNodeType =
  | 'dialog-analysis'
  | 'dialog-generation'
  | 'dialog-check'
  | 'dialog-audio'
  | 'extension-analysis'
  | 'extension-check'
  | 'extension-relationship-analysis'
  | 'extension-relationship-check'
  | 'vocabulary-detail'
  | 'vocabulary-audio'
  | 'chat-response';

export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'custom';

/**
 * Node context passed to node.execute()
 * Contains input, previous output, and other context
 * 
 * When starting at a specific step (startIndex), nodes receive:
 * - input: The input specified in contextUpdate (from backNodeHandler)
 * - previousOutput: The previous output if needed (from contextUpdate)
 * - _partialState: Optional partial state from previous workflow (if restarting)
 *   The node can access this via `context._partialState` if it needs to reference
 *   previous workflow results beyond what's in contextUpdate
 */
export interface NodeContext {
  input: unknown; // Current input for this node
  previousOutput?: unknown; // Output from previous node
  metadata?: Record<string, unknown>;
  learningLanguage?: string; // Language the user wants to learn
  userLanguage?: string; // Language the user uses (UI language)
  _partialState?: Partial<FlowState>; // Optional partial state from previous workflow (when restarting at a step)
  [key: string]: unknown; // Additional context can be added
}

export interface NodeResult<T = unknown> {
  success: boolean;
  output: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PreNodeConfig {
  type: PreNodeType;
  maxLength?: number; // for summarize
  format?: 'json' | 'markdown' | 'text' | 'structured';
  targetStructure?: Record<string, unknown>; // for transform-message
  validationRules?: Array<{
    field: string;
    required?: boolean;
    type?: 'string' | 'number' | 'array' | 'object';
    validator?: (value: unknown) => boolean;
  }>;
}

export interface LLMNodeConfig {
  type: LLMNodeType;
  provider?: LLMProvider;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  userPromptTemplate?: string;
  responseFormat?: 'json' | 'text' | 'markdown';
  showResponse?: boolean; // Whether to show the response in the dialog UI
}

/**
 * Back node handler result
 * Defines how to go back to a node with new input and selected outputs
 */
export interface BackNodeHandlerResult {
  targetNodeId: string; // Node ID to go back to
  contextUpdate: Partial<NodeContext>; // Context to update (input, previousOutput, etc.)
  /**
   * Optional: specify which step outputs to include in context
   * If not specified, only the target node's previous output is used
   */
  includeOutputs?: {
    nodeId: string; // Node ID whose output to include
    as?: string; // Key name in context (default: nodeId)
  }[];
}

/**
 * Base Node interface
 */
export interface BaseNode {
  id: string;
  name: string;
  description?: string;
  execute: (context: NodeContext) => Promise<NodeResult>;
  showResponse?: boolean; // Whether to show the response in the dialog UI
  /**
   * Back node handler - allows going back to a certain node with new input
   * Called when user wants to "extend" or "go back" from this node
   * If not provided, checks flow-level backNodeHandler
   */
  backNodeHandler?: (state: FlowState, backInput: string, currentNodeOutput: unknown) => BackNodeHandlerResult | null;
}

/**
 * Pre-processing Node
 * Handles data transformation, formatting, validation before LLM calls
 */
export interface PreNode extends BaseNode {
  nodeType: 'pre';
  config: PreNodeConfig;
}

/**
 * LLM Node
 * Handles LLM API calls with different providers
 */
export interface LLMNode extends BaseNode {
  nodeType: 'llm';
  config: LLMNodeConfig;
}

export type Node = PreNode | LLMNode;

export type FlowStatus = 'idle' | 'running' | 'completed' | 'error' | 'paused' | 'waiting-operation';

export interface FlowStep {
  nodeId: string;
  node: Node;
  result?: NodeResult;
  executed: boolean;
  timestamp?: number;
}

/**
 * Validation check function
 * Returns true if valid, false if invalid (should retry)
 */
export type ValidationCheck = (result: NodeResult) => boolean;

/**
 * Node operation handler
 * Called when user performs the operation
 * @param result - The result from the node execution
 * @param userInput - Optional user input for the operation
 * @returns Target node ID to go back to for restart, or null for confirm/reject
 */
export type NodeOperationHandler = (result: NodeResult, userInput?: string) => string | null;

/**
 * Node operation definition
 */
export interface NodeOperation {
  action: string; // e.g., 'confirm', 'restart'
  label: string; // Display label, e.g., 'Confirm', 'Extend'
  handler?: NodeOperationHandler; // Handler for restart operations (returns target node ID)
}

/**
 * Flow event for streaming updates
 */
export interface FlowEvent {
  type: 'step-start' | 'step-complete' | 'step-error' | 'status-change' | 'stream-chunk' | 'operation-required';
  flowId: string;
  stepIndex?: number;
  nodeId?: string;
  data?: unknown;
  error?: string;
  status?: FlowStatus;
  operations?: NodeOperation[]; // Available operations when waiting
}

export interface FlowCondition {
  nodeId: string;
  condition: (result: NodeResult) => boolean;
  onTrue: string; // next node ID
  onFalse: string; // fallback node ID (e.g., go back)
}

/**
 * Validation check configuration for a node
 */
export interface NodeValidationCheck {
  nodeId: string;
  check: ValidationCheck;
  maxRetries?: number; // Default: 3
  retryTargetNodeId?: string; // Node to go back to if invalid. If not provided, goes back to previous node
}

/**
 * Flow configuration
 */
export interface FlowConfig {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  conditions?: FlowCondition[];
  defaultNext?: (currentNodeId: string) => string | null; // custom routing function
  /**
   * Validation checks - if result is invalid, retry up to maxRetries times
   * After max retries, workflow is rejected
   */
  validationChecks?: NodeValidationCheck[];
  /**
   * Node operations - actions that pause workflow and wait for user input
   * Operations like 'confirm', 'restart' that require user interaction
   */
  nodeOperations?: Record<string, NodeOperation[]>; // nodeId -> operations
  /**
   * On failure, continue with input instead of stopping
   */
  continueOnFailure?: boolean;
}

export interface FlowState {
  config: FlowConfig;
  currentStepIndex: number;
  steps: FlowStep[];
  status: FlowStatus;
  context: NodeContext;
  error?: string;
  /**
   * Flow session ID for server-side tracking
   */
  sessionId?: string;
}

/**
 * Flow execution request from client
 */
export interface FlowExecutionRequest {
  flowId: string;
  input: unknown;
  context?: Partial<NodeContext>;
  sessionId?: string;
  continueOnFailure?: boolean;
  /**
   * Start execution from a specific step index (for extend/retry functionality)
   * If provided, workflow will start executing from this step instead of step 0
   * The node at this step will receive the input/context and can optionally use partialState
   */
  startIndex?: number;
  /**
   * Partial state from a previous workflow (optional)
   * When starting at a specific step, this provides reference to previous workflow state
   * The starting node can decide what it needs from this partial state
   */
  partialState?: Partial<FlowState>;
  /**
   * User-provided AI configuration
   * Note: apiKey is stored in HTTP-only cookie, not sent in request body
   */
  aiConfig?: {
    provider: string;
    apiKey?: string; // Optional - read from HTTP-only cookie on server
    apiUrl?: string;
    model?: string;
  };
}


/**
 * Flow control request
 */
export interface FlowControlRequest {
  sessionId: string;
  action: 'pause' | 'resume' | 'confirm' | 'reject' | 'restart';
  data?: unknown; // For 'restart', this should contain user's input (e.g., extension request)
  operationAction?: string; // The operation action name (e.g., 'confirm', 'restart')
}

export interface LLMAPIRequest {
  provider: LLMProvider;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
}

