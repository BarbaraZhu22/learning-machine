/**
 * Flow system for learning language agent
 * Supports composable flows with conditional routing
 *
 * Note: All flow execution happens server-side via API routes.
 * Client uses useFlowController hook to interact with flows.
 *
 */

import type {
  Node,
  NodeContext,
  NodeResult,
  FlowStep,
  FlowCondition,
  FlowConfig,
  FlowState,
  FlowStatus,
  BackNodeHandlerResult,
} from "./types";
import { createPreNode } from "./pre-node";
import { createLLMNode } from "./llm-node";

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
      status: "idle",
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
    if (this.state.status === "running") {
      throw new Error("Flow is already running");
    }

    this.state.status = "running";
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

          this.state.status = "error";
          this.state.error = result.error || "Node execution failed";
          break;
        }

        // Determine next node
        const nextNodeId = this.getNextNodeId(step.nodeId, result);

        if (nextNodeId === null) {
          // Flow completed
          this.state.status = "completed";
          break;
        }

        const nextIndex = this.findNodeIndex(nextNodeId);
        if (nextIndex === -1) {
          this.state.status = "error";
          this.state.error = `Next node not found: ${nextNodeId}`;
          break;
        }

        this.state.currentStepIndex = nextIndex;
      }

      if (this.state.status === "running") {
        this.state.status = "completed";
      }
    } catch (error) {
      this.state.status = "error";
      this.state.error =
        error instanceof Error ? error.message : "Unknown error";
    }

    return this.getState();
  }

  /**
   * Execute next step (for step-by-step execution)
   */
  async executeNext(): Promise<NodeResult | null> {
    if (this.state.currentStepIndex >= this.state.steps.length) {
      this.state.status = "completed";
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
      this.state.status = "error";
      this.state.error = result.error || "Node execution failed";
      return result;
    }

    this.state.currentStepIndex++;

    if (this.state.currentStepIndex >= this.state.steps.length) {
      this.state.status = "completed";
    }

    return result;
  }

  /**
   * Pause the flow
   */
  pause(): void {
    if (this.state.status === "running") {
      this.state.status = "paused";
    }
  }

  /**
   * Resume the flow
   */
  resume(): void {
    if (this.state.status === "paused") {
      this.state.status = "running";
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
    this.state.status = "idle";
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
   * Update current step index
   */
  setCurrentStepIndex(index: number): void {
    if (index >= 0 && index < this.state.steps.length) {
      this.state.currentStepIndex = index;
    }
  }

  /**
   * Update status
   */
  setStatus(status: FlowStatus): void {
    this.state.status = status;
  }

  /**
   * Set error
   */
  setError(error: string | undefined): void {
    this.state.error = error;
  }

  /**
   * Set step result directly on the flow's state
   */
  setStepResult(stepIndex: number, result: NodeResult): void {
    if (stepIndex >= 0 && stepIndex < this.state.steps.length) {
      this.state.steps[stepIndex].result = result;
      this.state.steps[stepIndex].executed = true;
      this.state.steps[stepIndex].timestamp = Date.now();
    }
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
      throw new Error("Flow ID and name are required");
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
    provider?: "deepseek" | "openai" | "anthropic" | "custom";
    apiKey?: string;
    apiUrl?: string;
    model?: string;
  },
  options?: {
    continueOnFailure?: boolean;
  }
): Flow {
  const builder = new FlowBuilder(
    "simulate-dialog",
    "Simulate Dialog"
  ).setDescription("Generate and validate dialog scenarios");

  // Pre node: Validate and Transform input (merged)
  const validateAndTransform = createPreNode(
    "validate-and-transform-dialog-input",
    "Validate and Transform Dialog Input",
    {
      type: "validate-and-transform",
      validationRules: [
        { field: "situation", required: true, type: "string" },
        { field: "characterA", required: false, type: "string" },
        { field: "characterB", required: false, type: "string" },
      ],
      targetStructure: {
        situation: "",
        characterA: "",
        characterB: "",
        notes: "",
      },
    }
  );

  // LLM node: Dialog Analysis
  const dialogAnalysis = createLLMNode(
    "dialog-analysis",
    "Dialog Analysis",
    {
      type: "dialog-analysis",
      provider: llmConfig?.provider || "deepseek",
      // apiKey is never stored in config - it's passed at execution time from cookies
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        "You are a language learning assistant. Analyze dialog scenarios and extract key information.",
      userPromptTemplate:
        "Analyze this dialog scenario: {{input}}\n\nProvide analysis in JSON format with: number_of_characters, situation_description, and target_language.",
      responseFormat: "json",
      showResponse: true, // Show response in dialog
    },
    "Analyze dialog scenario to understand characters and situation"
  );

  // LLM node: Dialog Generation
  const dialogGeneration = createLLMNode(
    "dialog-generation",
    "Dialog Generation",
    {
      type: "dialog-generation",
      provider: llmConfig?.provider || "deepseek",
      // apiKey is never stored in config - it's passed at execution time from cookies
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        "You are a language learning assistant. Generate natural dialog conversations based on the scenario and analysis.",
      userPromptTemplate:
        '{{#if previousDialog}}You are extending an existing dialog. Previous dialog:\n{{previousDialog}}\n\nUser extension request: {{extensionRequest}}\n\nPlease extend the dialog naturally, maintaining the same characters and style. You have two options:\n1. Append new entries to the end (old + new)\n2. Integrate new entries throughout the dialog where they make sense (old mixed with new)\n\nChoose the approach that creates the most natural and coherent conversation flow. After combining the dialogs, ensure the entire dialog makes sense as a whole - check for:\n- Logical flow and continuity\n- Natural conversation progression\n- Consistent character behavior and style\n- Appropriate transitions between old and new content\n\nIf the extension request suggests inserting content at a specific point or modifying existing content, you may need to reorganize or mix the entries. The final dialog should read as one cohesive conversation.\n\nThe output MUST be in JSON format with:\n- "characters": ["characterAName", "characterBName"]\n- "dialog": [\n    {\n      "character": "characterAName",\n      "use_text": "...",\n      "learn_text": "..."\n    },\n    ...all entries (old and new, properly integrated)...\n  ]\n{{else}}Based on the analysis: {{input}}\n\n{{dialogFormatInstructions}}\n\nGenerate a natural dialog conversation. The output MUST be in JSON format with:\n- "characters": ["characterAName", "characterBName"]\n- "dialog": [\n    {\n      "character": "characterAName",\n      "use_text": "...",\n      "learn_text": "..."\n    },\n    ...\n  ]\n\nMake the dialog natural, relevant to the situation, and appropriate for language learning.{{/if}}',
      responseFormat: "json",
      showResponse: true, // Show response in dialog
    },
    "Generate dialog conversation with both user and learning language"
  );

  // LLM node: Dialog Check
  const dialogCheckNode = createLLMNode(
    "dialog-check",
    "Dialog Check",
    {
      type: "dialog-check",
      provider: llmConfig?.provider || "deepseek",
      // apiKey is never stored in config - it's passed at execution time from cookies
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        "You are a language learning assistant. Validate dialog content for correctness, relevance, and quality.",
      userPromptTemplate:
        'Validate this generated dialog against the original analysis.\n\nOriginal Analysis:\n{{previousOutput}}\n\nGenerated Dialog:\n{{input}}\n\n{{validationInstructions}}\n\nCheck if the dialog is:\n1. Valid (properly formatted with characters and dialog array)\n2. Relevant to the original scenario and analysis\n3. Appropriate for language learning\n4. Natural and coherent\n\nReturn JSON with:\n- "is_valid": true/false if not valid',
      responseFormat: "json",
      showResponse: false,
    },
    "Validate generated dialog correctness and relevance"
  );

  // Add backNodeHandler to dialog-check node
  // This allows going back to dialog-generation with new extension input
  // Only brings the dialog-generation output (not dialog-check output)
  const dialogCheck = {
    ...dialogCheckNode,
    backNodeHandler: (
      state: FlowState,
      backInput: string,
      currentNodeOutput: unknown
    ): BackNodeHandlerResult | null => {
      // Find dialog-generation step to get its output
      const dialogGenStep = state.steps.find(
        (s) => s.nodeId === "dialog-generation"
      );
      const dialogGenOutput = dialogGenStep?.result?.output;

      if (!dialogGenOutput) {
        return null; // Fall back to default behavior
      }

      // Get original analysis from dialog-analysis step
      const dialogAnalysisStep = state.steps.find(
        (s) => s.nodeId === "dialog-analysis"
      );
      const originalAnalysis = dialogAnalysisStep?.result?.output;

      return {
        targetNodeId: "dialog-generation",
        contextUpdate: {
          input: {
            previousDialog: dialogGenOutput,
            extensionRequest: backInput,
            ...(originalAnalysis ? { originalAnalysis } : {}),
          },
          previousOutput: dialogGenOutput, // Use dialog-generation output, not dialog-check output
        },
        // Only include dialog-generation output, not dialog-check output
        includeOutputs: [
          { nodeId: "dialog-generation", as: "previousDialog" },
          ...(originalAnalysis
            ? [{ nodeId: "dialog-analysis", as: "originalAnalysis" }]
            : []),
        ],
      };
    },
  };

  // LLM node: Dialog Audio Generation
  const dialogAudio = createLLMNode(
    "dialog-audio",
    "Dialog Audio",
    {
      type: "dialog-audio",
      provider: llmConfig?.provider || "deepseek",
      // apiKey is never stored in config - it's passed at execution time from cookies
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        "You are a language learning assistant. Analyze dialog content and generate character voice analysis. Read the learn_text (learning language text) from the dialog and suggest appropriate voices for each character.",
      userPromptTemplate:
        'Analyze this validated dialog and generate character voice analysis:\n\n{{input}}\n\nFirst, extract the character names from the dialog. The dialog should have a "characters" array with the actual character names.\n\nFor each character in the dialog, suggest an appropriate voice description.\n\nReturn JSON format where the keys are the actual character names from the dialog (not "characterAName" or "characterBName"). For example, if the characters are ["顾客", "店员"], return:\n{\n  "顾客": "voice description for 顾客",\n  "店员": "voice description for 店员"\n}\n\nMake sure:\n1. Use the actual character names from the dialog\'s "characters" array as keys\n2. Each character has a distinct voice description\n3. The description is appropriate for the character\'s role and context\n4. For languages with significant gender differences in vocabulary (e.g., Japanese, Korean, Arabic, Spanish), always include gender in the voice description. For example: "cheerful female voice" or "deep male voice" (use English for gender specification)',
      responseFormat: "json",
    },
    "Generate character voice analysis for dialog"
  );

  const flow = builder
    .addNode(validateAndTransform)
    .addNode(dialogAnalysis)
    .addNode(dialogGeneration)
    .addNode(dialogCheck)
    .addNode(dialogAudio)
    .build();

  // Get the config to add validation check and operations
  const state = flow.getState();
  const config = state.config;

  // Add validation check for dialog-check (if invalid, retry dialog-generation)
  if (!config.validationChecks) {
    config.validationChecks = [];
  }
  config.validationChecks.push({
    nodeId: "dialog-check",
    check: (result) => {
      if (!result.success) return false;
      const output = result.output as Record<string, unknown>;
      // Check for various possible field names
      return (
        output.valid === true ||
        output.isValid === true ||
        output.is_valid === true
      );
    },
    maxRetries: 3,
    retryTargetNodeId: "dialog-generation", // Go back to dialog-generation if invalid
  });

  // Add operations for dialog-check (confirm and restart/extend)
  if (!config.nodeOperations) {
    config.nodeOperations = {};
  }
  config.nodeOperations["dialog-check"] = [
    {
      action: "confirm",
      label: "Confirm",
    },
    {
      action: "restart",
      label: "Extend",
      handler: (result, userInput) => {
        // Restart goes back to dialog-generation
        return "dialog-generation";
      },
    },
  ];

  // No condition needed - validation check handles invalid cases (retry)
  // When valid, operations pause workflow. When confirm clicked, default next
  // (next node in sequence) will route to dialog-audio automatically

  // Apply options - get fresh state
  const finalState = flow.getState();
  if (options?.continueOnFailure !== undefined) {
    finalState.config.continueOnFailure = options.continueOnFailure;
  }

  return flow;
}

/**
 * Flow 2: Extend Vocabulary
 * Node 1: Analysis - Analyze input, extract vocabulary, output structured format
 * Node 2: Generate Vocabulary - Generate vocabulary with nodes and links
 * Node 3: Validation - Validate and fix vocabulary, links, meanings
 */
export function createExtendVocabularyFlow(
  llmConfig?: {
    provider?: "deepseek" | "openai" | "anthropic" | "custom";
    apiKey?: string;
    apiUrl?: string;
    model?: string;
  },
  options?: {
    continueOnFailure?: boolean;
  }
): Flow {
  const builder = new FlowBuilder(
    "extend-vocabulary",
    "Extend Vocabulary"
  ).setDescription(
    "Analyze input, generate vocabulary with relationships, and validate"
  );

  // Node 1: Vocabulary Analysis
  // Analyzes input, extracts vocabulary, outputs structured format with vocabulary, topicFocus, vocabularyCount, condition
  const vocabularyAnalysis = createLLMNode(
    "vocabulary-analysis",
    "Vocabulary Analysis",
    {
      type: "extension-analysis",
      provider: llmConfig?.provider || "deepseek",
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        "You are a language learning assistant. Analyze vocabulary extension requests and extract vocabulary from input text.",
      userPromptTemplate: `Analyze the input and find vocabulary in it.

Input: {{input}}

Cached Vocabulary (learning language: {{learningLanguage}}):
{{vocabularyCache}}

Instructions:
1. Extract vocabulary words from the input text (in learning language: {{learningLanguage}})
2. If you cannot find 50 vocabulary items in the input, or if there's no valid input, set vocabulary to an empty array []
3. Determine topic focus areas from the input
4. Set default vocabulary count to 50 if not specified
5. Identify relationship conditions needed: synonyms, antonyms, cognates, fixed collocations, or other relationships (use system language: {{userLanguage}} for these terms)
6. If no valid input, the topic should be based on extending current vocabulary (avoid repeating cached vocabulary)
7. New vocabulary must avoid repetition with cached vocabulary (words are case-insensitive)

Output MUST be in JSON format:
{
  "vocabulary": ["word1", "word2", ...], // Array of vocabulary words found in input (in learning language), or [] if not enough found
  "topicFocus": ["topic1", "topic2", ...], // Array of topics/focus areas
  "coreTopicVocabulary": "核心词", // Core topic vocabulary word (in learning language) - the main theme word, used for linking nodes with "其他关系"
  "vocabularyCount": 50, // Default 50, number of vocabulary items to generate
  "condition": ["synonym", "antonym", "cognate", "collocation", "other"] // Array of relationship types needed (in system language: {{userLanguage}})
}

If no vocabulary found in input, set vocabulary to [] and determine topicFocus based on extending current vocabulary. The coreTopicVocabulary should be the main theme/topic word in learning language.`,
      responseFormat: "json",
      showResponse: true,
    },
    "Analyze input, extract vocabulary, and determine extension parameters"
  );

  // Node 2: Vocabulary Generation 1 - Generate vocabulary nodes only
  const vocabularyGeneration1 = createLLMNode(
    "vocabulary-generation-1",
    "Vocabulary Generation",
    {
      type: "extension-analysis",
      provider: llmConfig?.provider || "deepseek",
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        "You are a language learning assistant. Generate vocabulary nodes based on analysis parameters.",
      userPromptTemplate: `Based on the analysis, generate vocabulary nodes only (no links).

Analysis:
{{input}}

Cached Vocabulary (learning language: {{learningLanguage}}, system language: {{userLanguage}}):
{{vocabularyCache}}

Instructions:
1. Generate exactly vocabularyCount vocabulary items based on topicFocus
2. All words must be in the learning language ({{learningLanguage}}) - original format
3. All meanings/explanations must be in the system language ({{userLanguage}})
4. Provide phonetic/pronunciation for each word: {{phoneticFormatInstruction}}
5. Avoid any repetition with cached vocabulary (case-insensitive comparison)
6. Include the coreTopicVocabulary from analysis if it's not already in the vocabulary
7. Add a "tags" array to each node with the coreTopicVocabulary as a tag

Output MUST be in JSON format:
{
  "nodes": [
    {
      "word": "单词", // Word in learning language ({{learningLanguage}})
      "phonetic": "phonetic notation", // Phonetic/pronunciation: {{phoneticFormatInstruction}}
      "meaning": "word meaning", // Meaning/explanation in system language ({{userLanguage}})
      "tags": ["核心词"] // Tags array containing coreTopicVocabulary from analysis
    },
    ...
  ]
}

Generate exactly vocabularyCount nodes. Do not generate links.`,
      responseFormat: "json",
      showResponse: true,
    },
    "Generate vocabulary nodes only"
  );

  // Node 3: Vocabulary Validation 1 - Validate vocabulary nodes only
  const vocabularyValidation1 = createLLMNode(
    "vocabulary-validation-1",
    "Vocabulary Validation",
    {
      type: "extension-check",
      provider: llmConfig?.provider || "deepseek",
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        "You are a language learning assistant. Validate vocabulary nodes and meanings for correctness.",
      userPromptTemplate: `Validate the vocabulary nodes for format and meaning correctness.

Vocabulary Nodes:
{{input}}

Cached Vocabulary (learning language: {{learningLanguage}}):
{{vocabularyCache}}

Validation Rules (check only these):
1. Each node must have a "word" field that is in learning language ({{learningLanguage}}) - original format, not translated
2. Each node must have a "phonetic" field with pronunciation/phonetic notation
3. Each node must have a "meaning" field that is in system language ({{userLanguage}})
4. Word should not be empty or invalid
5. Phonetic should not be empty or invalid
6. Meaning should not be empty or invalid

For each invalid node, output an issue in the format: "word: issue description"

Output MUST be in JSON format:
{
  "is_valid": true/false,
  "nodes": [...], // Same nodes as input (do not modify)
  "issues": ["word1: issue description", "word2: issue description", ...] // Array of issues found (empty array if all valid)
}

Only output issues for nodes that are invalid. Do not modify the nodes.`,
      responseFormat: "json",
      showResponse: false,
    },
    "Validate vocabulary nodes format and meanings"
  );

  // Pre-node 1: Clean Invalid Vocabulary Nodes (after validation 1)
  const cleanInvalidVocabularyPreNode = createPreNode(
    "clean-invalid-vocabulary-pre",
    "Clean Invalid Vocabulary",
    {
      type: "clean-invalid-vocabulary-nodes",
    },
    "Remove invalid vocabulary nodes based on validation issues"
  );

  // Node 4: Vocabulary Generation 2 - Generate links only
  const vocabularyGeneration2 = createLLMNode(
    "vocabulary-generation-2",
    "Link Generation",
    {
      type: "extension-analysis",
      provider: llmConfig?.provider || "deepseek",
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt:
        "You are a language learning assistant. Generate relationship links between vocabulary words.",
      userPromptTemplate: `Generate relationship links for the vocabulary nodes.

Vocabulary Nodes (from previous step):
{{input}}

Instructions:
1. Use the nodes provided in the input - do not modify or regenerate them
2. Generate links between vocabulary words based ONLY on these relationship types (in system language: {{userLanguage}}):
   - 同义词 (synonym)
   - 反义词 (antonym)
   - 近义词 (near synonym)
   - 同源词 (cognate)
3. Only generate links if there is a clear relationship matching one of the above types
4. Do not generate links for every word - only when a clear relationship exists
5. All words in links (start and end) must be from the input nodes
6. All words must be in learning language ({{learningLanguage}}) - original format

You will receive vocabulary nodes as input. Generate links between these nodes.

Output MUST be in JSON format with ONLY links (do not include nodes):
{
  "links": [
    {
      "start": "单词1", // Starting word (in learning language, from input nodes)
      "end": "单词2", // Ending word (in learning language, from input nodes)
      "relationship": "同义词" // Relationship type in system language ({{userLanguage}}): must be one of: 同义词, 反义词, 近义词, 同源词
    },
    ...
  ]
}

IMPORTANT: Only output links. Do not include nodes in output. Only generate links where a clear relationship exists matching one of the 4 types above. Do not generate links for all words.`,
      responseFormat: "json",
      showResponse: true,
    },
    "Generate relationship links between vocabulary words"
  );

  // Pre-node: Merge nodes and links, clean and complete
  // Merge nodes from clean step with links from generation 2
  // Remove 固定搭配 links, filter invalid links, add nodes without links to coreTopicVocabulary
  const mergeNodesLinksPreNode = createPreNode(
    "merge-nodes-links-pre",
    "Merge and Complete Links",
    {
      type: "merge-vocabulary-nodes-links",
    },
    "Merge vocabulary nodes with generated links, filter invalid links, and add core topic links"
  );

  const flow = builder
    .addNode(vocabularyAnalysis)
    .addNode(vocabularyGeneration1)
    .addNode(vocabularyValidation1)
    .addNode(cleanInvalidVocabularyPreNode)
    .addNode(vocabularyGeneration2)
    .addNode(mergeNodesLinksPreNode)
    .build();

  // Add validation check for vocabulary-validation-1 node
  // If invalid nodes > 20% of total, regenerate; otherwise proceed
  const finalState = flow.getState();
  if (!finalState.config.validationChecks) {
    finalState.config.validationChecks = [];
  }
  finalState.config.validationChecks.push({
    nodeId: "vocabulary-validation-1",
    check: (result) => {
      if (!result.success) return false;
      const output = result.output as Record<string, unknown>;
      const issues = (output.issues as Array<unknown>) || [];
      const nodes = (output.nodes as Array<unknown>) || [];

      // If invalid nodes > 20% of total nodes, regenerate
      const totalNodes = nodes.length;
      const invalidCount = issues.length;
      const invalidPercentage =
        totalNodes > 0 ? (invalidCount / totalNodes) * 100 : 0;

      // If more than 20% invalid, return false to trigger regeneration
      if (invalidPercentage > 20) {
        return false;
      }

      // Otherwise, proceed (even if there are some issues)
      return true;
    },
    maxRetries: 3,
    retryTargetNodeId: "vocabulary-generation-1",
  });

  // Apply options
  if (options?.continueOnFailure !== undefined) {
    finalState.config.continueOnFailure = options.continueOnFailure;
  }

  return flow;
}

/**
 * Flow 3: Simple Chat (Regular Chat)
 * Single LLM node for regular chat conversations
 * showResponse: false so header is not shown
 */
export function createSimpleChatFlow(llmConfig?: {
  provider?: "deepseek" | "openai" | "anthropic" | "custom";
  apiKey?: string;
  apiUrl?: string;
  model?: string;
}): Flow {
  const builder = new FlowBuilder("chat", "Simple Chat").setDescription(
    "Regular chat conversation"
  );

  // Single LLM node for chat
  const chatNode = createLLMNode(
    "chat-response",
    "Chat Response",
    {
      type: "chat-response",
      provider: llmConfig?.provider || "deepseek",
      // apiKey is never stored in config - it's passed at execution time from cookies
      apiUrl: llmConfig?.apiUrl,
      model: llmConfig?.model,
      systemPrompt: "You are a helpful assistant.",
      userPromptTemplate: "{{input}}",
      responseFormat: "text",
      showResponse: false, // Don't show workflow header for regular chat
    },
    "Respond to user messages in a conversational way"
  );

  const flow = builder.addNode(chatNode).build();

  return flow;
}
