/**
 * Type definitions for learning language agent nodes and flows
 */

export type PreNodeType =
  | 'format'
  | 'summarize'
  | 'organize'
  | 'transform-message'
  | 'validate-input';

export type LLMNodeType =
  | 'dialog-analysis'
  | 'dialog-check'
  | 'dialog-audio'
  | 'extension-analysis'
  | 'extension-check'
  | 'extension-relationship-analysis'
  | 'extension-relationship-check'
  | 'vocabulary-detail'
  | 'vocabulary-audio';

export type LLMProvider = 'deepseek' | 'openai' | 'anthropic' | 'custom';

export interface NodeContext {
  input: unknown;
  previousOutput?: unknown;
  metadata?: Record<string, unknown>;
  learningLanguage?: string;
  [key: string]: unknown;
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
}

/**
 * Base Node interface
 */
export interface BaseNode {
  id: string;
  name: string;
  description?: string;
  execute: (context: NodeContext) => Promise<NodeResult>;
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

export type FlowStatus = 'idle' | 'running' | 'completed' | 'error' | 'paused' | 'waiting-confirmation';

export interface FlowStep {
  nodeId: string;
  node: Node;
  result?: NodeResult;
  executed: boolean;
  timestamp?: number;
}

/**
 * Flow event for streaming updates
 */
export interface FlowEvent {
  type: 'step-start' | 'step-complete' | 'step-error' | 'status-change' | 'stream-chunk' | 'confirmation-required';
  flowId: string;
  stepIndex?: number;
  nodeId?: string;
  data?: unknown;
  error?: string;
  status?: FlowStatus;
}

export interface FlowCondition {
  nodeId: string;
  condition: (result: NodeResult) => boolean;
  onTrue: string; // next node ID
  onFalse: string; // fallback node ID (e.g., go back)
}

export interface FlowConfig {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  conditions?: FlowCondition[];
  defaultNext?: (currentNodeId: string) => string | null; // custom routing function
  /**
   * Node IDs that require user confirmation before proceeding
   */
  confirmationNodes?: string[];
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
  confirmationNodes?: string[];
  continueOnFailure?: boolean;
  /**
   * User-provided AI configuration (from localStorage)
   */
  aiConfig?: {
    provider: string;
    apiKey: string;
    apiUrl?: string;
    model?: string;
  };
}


/**
 * Flow control request (pause, resume, confirm)
 */
export interface FlowControlRequest {
  sessionId: string;
  action: 'pause' | 'resume' | 'confirm' | 'reject' | 'skip' | 'retry';
  data?: unknown;
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

