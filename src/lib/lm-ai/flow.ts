/**
 * Flow system for learning language agent
 * Supports composable flows with conditional routing
 * 
 * Note: All flow execution happens server-side via API routes.
 * Client uses useFlowController hook to interact with flows.
 * 
 * Environment variables (add to .env.local):
 * - DEEPSEEK_API_KEY (default provider)
 * - OPENAI_API_KEY (optional)
 * - ANTHROPIC_API_KEY (optional)
 */

import type {
  Node,
  NodeContext,
  NodeResult,
  FlowStep,
  FlowCondition,
  FlowConfig,
  FlowState,
} from './types';
import { createPreNode } from './pre-node';
import { createLLMNode } from './llm-node';

export class Flow {
  private state: FlowState;

  constructor(config: FlowConfig, initialContext: NodeContext = { input: {} }) {
    const steps: FlowStep[] = config.nodes.map((node) => ({
      nodeId: node.id,
      node,
      executed: false,
    }));

    this.state = {
      config,
      currentStepIndex: 0,
      steps,
      status: 'idle',
      context: initialContext,
    };
  }

  /**
   * Get current flow state
   */
  getState(): FlowState {
    return { ...this.state };
  }

  /**
   * Execute the flow
   */
  async execute(): Promise<FlowState> {
    if (this.state.status === 'running') {
      throw new Error('Flow is already running');
    }

    this.state.status = 'running';
    this.state.error = undefined;

    try {
      while (this.state.currentStepIndex < this.state.steps.length) {
        const step = this.state.steps[this.state.currentStepIndex];
        
        // Execute current node
        const result = await step.node.execute(this.state.context);
        
        step.result = result;
        step.executed = true;
        step.timestamp = Date.now();

        // Update context with result
        this.state.context.previousOutput = result.output;
        this.state.context.input = result.output;

        // Handle node failure
        if (!result.success) {
          // Check if there's a condition to handle errors
          const condition = this.findCondition(step.nodeId);
          if (condition && !condition.condition(result)) {
            const nextNodeId = condition.onFalse;
            const nextIndex = this.findNodeIndex(nextNodeId);
            if (nextIndex !== -1) {
              this.state.currentStepIndex = nextIndex;
              continue;
            }
          }
          
          this.state.status = 'error';
          this.state.error = result.error || 'Node execution failed';
          break;
        }

        // Determine next node
        const nextNodeId = this.getNextNodeId(step.nodeId, result);
        
        if (nextNodeId === null) {
          // Flow completed
          this.state.status = 'completed';
          break;
        }

        const nextIndex = this.findNodeIndex(nextNodeId);
        if (nextIndex === -1) {
          this.state.status = 'error';
          this.state.error = `Next node not found: ${nextNodeId}`;
          break;
        }

        this.state.currentStepIndex = nextIndex;
      }

      if (this.state.status === 'running') {
        this.state.status = 'completed';
      }
    } catch (error) {
      this.state.status = 'error';
      this.state.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return this.getState();
  }

  /**
   * Execute next step (for step-by-step execution)
   */
  async executeNext(): Promise<NodeResult | null> {
    if (this.state.currentStepIndex >= this.state.steps.length) {
      this.state.status = 'completed';
      return null;
    }

    const step = this.state.steps[this.state.currentStepIndex];
    const result = await step.node.execute(this.state.context);

    step.result = result;
    step.executed = true;
    step.timestamp = Date.now();

    this.state.context.previousOutput = result.output;
    this.state.context.input = result.output;

    if (!result.success) {
      this.state.status = 'error';
      this.state.error = result.error || 'Node execution failed';
      return result;
    }

    this.state.currentStepIndex++;
    
    if (this.state.currentStepIndex >= this.state.steps.length) {
      this.state.status = 'completed';
    }

    return result;
  }

  /**
   * Pause the flow
   */
  pause(): void {
    if (this.state.status === 'running') {
      this.state.status = 'paused';
    }
  }

  /**
   * Resume the flow
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'running';
    }
  }

  /**
   * Reset the flow
   */
  reset(context?: NodeContext): void {
    this.state.steps.forEach((step) => {
      step.executed = false;
      step.result = undefined;
      step.timestamp = undefined;
    });
    this.state.currentStepIndex = 0;
    this.state.status = 'idle';
    this.state.error = undefined;
    if (context) {
      this.state.context = context;
    }
  }

  /**
   * Update context
   */
  updateContext(updates: Partial<NodeContext>): void {
    this.state.context = { ...this.state.context, ...updates };
  }

  /**
   * Add or replace a node in the flow
   */
  addNode(node: Node, index?: number): void {
    const step: FlowStep = {
      nodeId: node.id,
      node,
      executed: false,
    };

    if (index !== undefined && index >= 0 && index <= this.state.steps.length) {
      this.state.steps.splice(index, 0, step);
    } else {
      this.state.steps.push(step);
    }

    // Update config
    this.state.config.nodes = this.state.steps.map((s) => s.node);
  }

  /**
   * Remove a node from the flow
   */
  removeNode(nodeId: string): boolean {
    const index = this.findNodeIndex(nodeId);
    if (index === -1) return false;

    this.state.steps.splice(index, 1);
    this.state.config.nodes = this.state.steps.map((s) => s.node);

    if (this.state.currentStepIndex > index) {
      this.state.currentStepIndex--;
    }

    return true;
  }

  /**
   * Replace a node in the flow
   */
  replaceNode(nodeId: string, newNode: Node): boolean {
    const index = this.findNodeIndex(nodeId);
    if (index === -1) return false;

    this.state.steps[index].node = newNode;
    this.state.steps[index].nodeId = newNode.id;
    this.state.config.nodes = this.state.steps.map((s) => s.node);

    return true;
  }

  private findNodeIndex(nodeId: string): number {
    return this.state.steps.findIndex((step) => step.nodeId === nodeId);
  }

  private findCondition(nodeId: string): FlowCondition | undefined {
    return this.state.config.conditions?.find((c) => c.nodeId === nodeId);
  }

  private getNextNodeId(
    currentNodeId: string,
    result: NodeResult
  ): string | null {
    // Check custom routing function
    if (this.state.config.defaultNext) {
      const customNext = this.state.config.defaultNext(currentNodeId);
      if (customNext !== null) return customNext;
    }

    // Check conditions
    const condition = this.findCondition(currentNodeId);
    if (condition) {
      return condition.condition(result) ? condition.onTrue : condition.onFalse;
    }

    // Default: go to next node in sequence
    const currentIndex = this.findNodeIndex(currentNodeId);
    if (currentIndex === -1 || currentIndex >= this.state.steps.length - 1) {
      return null;
    }

    return this.state.steps[currentIndex + 1].nodeId;
  }
}

/**
 * Flow Builder for easy composition
 */
export class FlowBuilder {
  private config: Partial<FlowConfig>;
  private nodes: Node[] = [];
  private conditions: FlowCondition[] = [];

  constructor(id: string, name: string) {
    this.config = { id, name };
  }

  addNode(node: Node): this {
    this.nodes.push(node);
    return this;
  }

  addCondition(condition: FlowCondition): this {
    this.conditions.push(condition);
    return this;
  }

  setDefaultNext(nextFn: (currentNodeId: string) => string | null): this {
    this.config.defaultNext = nextFn;
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  build(): Flow {
    if (!this.config.id || !this.config.name) {
      throw new Error('Flow ID and name are required');
    }

    const config: FlowConfig = {
      id: this.config.id,
      name: this.config.name,
      description: this.config.description,
      nodes: this.nodes,
      conditions: this.conditions.length > 0 ? this.conditions : undefined,
      defaultNext: this.config.defaultNext,
    };

    return new Flow(config);
  }
}

/**
 * Predefined flows for learning language actions
 */

/**
 * Flow 1: Simulate Dialog
 * ValidateAndTransform => DialogAnalysis => DialogGeneration => DialogCheck (if not valid back to DialogGeneration) => DialogAudio
 */
export function createSimulateDialogFlow(
  llmConfig?: {
    provider?: 'deepseek' | 'openai' | 'anthropic' | 'custom';
    apiKey?: string;
    apiUrl?: string;
    model?: string;
  },
  options?: {
    confirmationNodes?: string[];
    continueOnFailure?: boolean;
  }
): Flow {
  const builder = new FlowBuilder('simulate-dialog', 'Simulate Dialog')
    .setDescription('Generate and validate dialog scenarios');

  // Pre node: Validate and Transform input (merged)
  const validateAndTransform = createPreNode(
    'validate-and-transform-dialog-input',
    'Validate and Transform Dialog Input',
    {
      type: 'validate-and-transform',
      validationRules: [
        { field: 'situation', required: true, type: 'string' },
        { field: 'characterA', required: false, type: 'string' },
        { field: 'characterB', required: false, type: 'string' },
      ],
      targetStructure: {
        situation: '',
        characterA: 'Character A',
        characterB: 'Character B',
        notes: '',
      },
    }
  );

  // LLM node: Dialog Analysis
  const dialogAnalysis = createLLMNode(
    'dialog-analysis',
    'Dialog Analysis',
    {
      type: 'dialog-analysis',
      provider: llmConfig?.provider || 'deepseek',
      apiKey: llmConfig?.apiKey,
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        'You are a language learning assistant. Analyze dialog scenarios and extract key information.',
      userPromptTemplate:
        'Analyze this dialog scenario: {{input}}\n\nProvide analysis in JSON format with: number_of_characters, situation_description, and target_language.',
      responseFormat: 'json',
    },
    'Analyze dialog scenario to understand characters and situation'
  );

  // LLM node: Dialog Generation
  const dialogGeneration = createLLMNode(
    'dialog-generation',
    'Dialog Generation',
    {
      type: 'dialog-generation',
      provider: llmConfig?.provider || 'deepseek',
      apiKey: llmConfig?.apiKey,
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        'You are a language learning assistant. Generate natural dialog conversations based on the scenario and analysis.',
      userPromptTemplate:
        'Based on the analysis: {{input}}\n\n{{dialogFormatInstructions}}\n\nGenerate a natural dialog conversation. The output MUST be in JSON format with:\n- "characters": ["characterAName", "characterBName"]\n- "dialog": [\n    {\n      "character": "characterAName",\n      "use_text": "...",\n      "learn_text": "..."\n    },\n    ...\n  ]\n\nMake the dialog natural, relevant to the situation, and appropriate for language learning.',
      responseFormat: 'json',
    },
    'Generate dialog conversation with both user and learning language'
  );

  // LLM node: Dialog Check
  const dialogCheck = createLLMNode(
    'dialog-check',
    'Dialog Check',
    {
      type: 'dialog-check',
      provider: llmConfig?.provider || 'deepseek',
      apiKey: llmConfig?.apiKey,
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        'You are a language learning assistant. Validate dialog content for correctness, relevance, and quality.',
      userPromptTemplate:
        'Validate this generated dialog against the original analysis.\n\nOriginal Analysis:\n{{previousOutput}}\n\nGenerated Dialog:\n{{input}}\n\n{{validationInstructions}}\n\nCheck if the dialog is:\n1. Valid (properly formatted with characters and dialog array)\n2. Relevant to the original scenario and analysis\n3. Appropriate for language learning\n4. Natural and coherent\n\nReturn JSON with:\n- "is_valid": true/false\n- "reasons": ["reason1", "reason2", ...] if not valid',
      responseFormat: 'json',
    },
    'Validate generated dialog correctness and relevance'
  );

  // LLM node: Dialog Audio (preparation)
  const dialogAudio = createLLMNode(
    'dialog-audio',
    'Dialog Audio',
    {
      type: 'dialog-audio',
      provider: llmConfig?.provider || 'deepseek',
      apiKey: llmConfig?.apiKey,
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        'You are a language learning assistant. Prepare dialog content for audio generation.',
      userPromptTemplate: 'Prepare this dialog for audio generation: {{input}}',
      responseFormat: 'json',
    },
    'Prepare dialog for audio generation'
  );

  const flow = builder
    .addNode(validateAndTransform)
    .addNode(dialogAnalysis)
    .addNode(dialogGeneration)
    .addNode(dialogCheck)
    .addNode(dialogAudio)
    .addCondition({
      nodeId: 'dialog-check',
      condition: (result) => {
        if (!result.success) return false;
        const output = result.output as Record<string, unknown>;
        // Check for various possible field names
        return (
          output.valid === true ||
          output.isValid === true ||
          output.is_valid === true
        );
      },
      onTrue: 'dialog-audio',
      onFalse: 'dialog-generation', // Go back to generation if check fails
    })
    .build();

  // Apply options
  const state = flow.getState();
  if (options?.confirmationNodes) {
    state.config.confirmationNodes = options.confirmationNodes;
  }
  if (options?.continueOnFailure !== undefined) {
    state.config.continueOnFailure = options.continueOnFailure;
  }

  return flow;
}

/**
 * Flow 2: Extend Vocabulary
 * ExtensionAnalysis => ExtensionCheck (if not valid back to ExtensionAnalysis) => ExtensionRelationshipAnalysis => ExtensionRelationshipCheck
 */
export function createExtendVocabularyFlow(
  llmConfig?: {
    provider?: 'deepseek' | 'openai' | 'anthropic' | 'custom';
    apiKey?: string;
    apiUrl?: string;
    model?: string;
  },
  options?: {
    confirmationNodes?: string[];
    continueOnFailure?: boolean;
  }
): Flow {
  const builder = new FlowBuilder('extend-vocabulary', 'Extend Vocabulary')
    .setDescription('Analyze and extend vocabulary with relationships');

  // Pre node: Format input
  const formatInput = createPreNode(
    'format-vocab-input',
    'Format Vocabulary Input',
    {
      type: 'format',
      format: 'structured',
    }
  );

  // LLM node: Extension Analysis
  const extensionAnalysis = createLLMNode(
    'extension-analysis',
    'Extension Analysis',
    {
      type: 'extension-analysis',
      provider: llmConfig?.provider || 'deepseek',
      apiKey: llmConfig?.apiKey,
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        'You are a language learning assistant. Analyze vocabulary extension requests.',
      userPromptTemplate:
        'Analyze this vocabulary extension request: {{input}}\n\nDetermine: vocabulary category (family, work, shopping, daily, etc.), number of words needed, and target language.',
      responseFormat: 'json',
    },
    'Analyze vocabulary extension requirements'
  );

  // LLM node: Extension Check
  const extensionCheck = createLLMNode(
    'extension-check',
    'Extension Check',
    {
      type: 'extension-check',
      provider: llmConfig?.provider || 'deepseek',
      apiKey: llmConfig?.apiKey,
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        'You are a language learning assistant. Validate vocabulary lists for correctness.',
      userPromptTemplate:
        'Check if these vocabularies are correct and related to the analysis: {{input}}',
      responseFormat: 'json',
    },
    'Validate vocabulary correctness'
  );

  // LLM node: Extension Relationship Analysis
  const extensionRelationshipAnalysis = createLLMNode(
    'extension-relationship-analysis',
    'Extension Relationship Analysis',
    {
      type: 'extension-relationship-analysis',
      provider: llmConfig?.provider || 'deepseek',
      apiKey: llmConfig?.apiKey,
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        'You are a language learning assistant. Analyze relationships between vocabulary words.',
      userPromptTemplate:
        'Define relationships for these words (固定搭配, 同义词, 同类词, 反义词, etc.): {{input}}',
      responseFormat: 'json',
    },
    'Analyze vocabulary relationships'
  );

  // LLM node: Extension Relationship Check
  const extensionRelationshipCheck = createLLMNode(
    'extension-relationship-check',
    'Extension Relationship Check',
    {
      type: 'extension-relationship-check',
      provider: llmConfig?.provider || 'deepseek',
      apiKey: llmConfig?.apiKey,
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        'You are a language learning assistant. Validate vocabulary relationships.',
      userPromptTemplate:
        'Check if these relationships are correct: {{input}}',
      responseFormat: 'json',
    },
    'Validate vocabulary relationships'
  );

  const flow = builder
    .addNode(formatInput)
    .addNode(extensionAnalysis)
    .addNode(extensionCheck)
    .addNode(extensionRelationshipAnalysis)
    .addNode(extensionRelationshipCheck)
    .addCondition({
      nodeId: 'extension-check',
      condition: (result) => {
        if (!result.success) return false;
        const output = result.output as Record<string, unknown>;
        return output.valid === true || output.isValid === true;
      },
      onTrue: 'extension-relationship-analysis',
      onFalse: 'extension-analysis', // Go back to analysis if check fails
    })
    .build();

  // Apply options
  const state = flow.getState();
  if (options?.confirmationNodes) {
    state.config.confirmationNodes = options.confirmationNodes;
  }
  if (options?.continueOnFailure !== undefined) {
    state.config.continueOnFailure = options.continueOnFailure;
  }

  return flow;
}
