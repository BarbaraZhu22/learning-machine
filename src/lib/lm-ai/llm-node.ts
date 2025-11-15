/**
 * LLM Node implementations
 * Handles LLM API calls with different providers
 */

import type {
  LLMNode,
  LLMNodeConfig,
  NodeContext,
  NodeResult,
  LLMProvider,
  LLMAPIRequest,
} from "./types";
import {
  getSystemLanguageInstruction,
  getUserLanguageContext,
  getDialogFormatInstructions,
  getDialogValidationInstructions,
} from "./language-hints";

/**
 * Create an LLM Node
 * Note: Nodes only execute on the server, so they always use direct API calls
 */
export function createLLMNode(
  id: string,
  name: string,
  config: LLMNodeConfig,
  description?: string
): LLMNode {
  const execute = async (context: NodeContext): Promise<NodeResult> => {
    try {
      const provider = config.provider || "deepseek";
      const input = context.input;
      const previousOutput = context.previousOutput;

      // Transform input to message structure based on provider
      const messages = await prepareMessages(
        input,
        config.userPromptTemplate,
        config.systemPrompt,
        config.responseFormat,
        previousOutput,
        context
      );

      // Direct API call (nodes only run server-side)
      // Note: apiKey should be passed via context._apiKey, not from config
      // The main execution path uses streaming in server-flow.ts which passes apiKey as parameter
      // This non-streaming execute is only used in special cases (like controlFlow restart)
      const apiKey = (context as any)._apiKey as string | undefined;
      if (!apiKey && provider !== "custom") {
        throw new Error("API key required but not provided in context. Use streaming execution path instead.");
      }
      
      const response = await callLLMAPI({
        provider,
        apiKey,
        apiUrl: config.apiUrl,
        model: config.model,
        messages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        responseFormat: config.responseFormat,
      });

      // Parse response based on format
      const output = await parseResponse(response, config.responseFormat);

      return {
        success: true,
        output,
        metadata: {
          nodeType: "llm",
          nodeId: id,
          provider,
          model: config.model,
        },
      };
    } catch (error) {
      return {
        success: false,
        output: context.input,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: { nodeType: "llm", nodeId: id },
      };
    }
  };

  return {
    id,
    name,
    description,
    nodeType: "llm",
    config,
    execute,
    showResponse: config.showResponse,
  };
}

/**
 * Prepare messages for LLM API call
 * Exported for use in streaming execution
 */
export async function prepareMessages(
  input: unknown,
  userPromptTemplate?: string,
  systemPrompt?: string,
  responseFormat?: string,
  previousOutput?: unknown,
  context?: NodeContext
): Promise<Array<{ role: string; content: string }>> {
  const messages: Array<{ role: string; content: string }> = [];

  // Helper to replace template variables
  const replaceTemplateVars = (template: string): string => {
    const inputStr =
      typeof input === "string" ? input : JSON.stringify(input, null, 2);
    const previousOutputStr =
      previousOutput !== undefined
        ? typeof previousOutput === "string"
          ? previousOutput
          : JSON.stringify(previousOutput, null, 2)
        : "";
    const userLanguage = context?.userLanguage || "en";
    const learningLanguage = context?.learningLanguage || "english";

    // Handle extension input (if input is an object with previousDialog and extensionRequest)
    let previousDialogStr = "";
    let extensionRequestStr = "";
    if (typeof input === "object" && input !== null && !Array.isArray(input)) {
      const inputObj = input as Record<string, unknown>;
      if (inputObj.previousDialog) {
        previousDialogStr =
          typeof inputObj.previousDialog === "string"
            ? inputObj.previousDialog
            : JSON.stringify(inputObj.previousDialog, null, 2);
      }
      if (inputObj.extensionRequest) {
        extensionRequestStr =
          typeof inputObj.extensionRequest === "string"
            ? inputObj.extensionRequest
            : String(inputObj.extensionRequest);
      }
    }

    // Replace special instruction variables
    const dialogFormatInstructions = getDialogFormatInstructions(context);
    const validationInstructions = getDialogValidationInstructions(context);

    let result = template
      .replace(/\{\{input\}\}/g, inputStr)
      .replace(/\{\{previousOutput\}\}/g, previousOutputStr)
      .replace(/\{\{userLanguage\}\}/g, userLanguage)
      .replace(/\{\{learningLanguage\}\}/g, learningLanguage)
      .replace(/\{\{dialogFormatInstructions\}\}/g, dialogFormatInstructions)
      .replace(/\{\{validationInstructions\}\}/g, validationInstructions);

    // Handle extension-specific variables
    if (previousDialogStr) {
      result = result.replace(/\{\{previousDialog\}\}/g, previousDialogStr);
    }
    if (extensionRequestStr) {
      result = result.replace(/\{\{extensionRequest\}\}/g, extensionRequestStr);
    }

    // Handle simple conditional: {{#if previousDialog}}...{{else}}...{{/if}}
    if (previousDialogStr) {
      result = result.replace(
        /\{\{#if previousDialog\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
        "$1"
      );
    } else {
      result = result.replace(
        /\{\{#if previousDialog\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
        "$2"
      );
    }

    return result;
  };

  if (systemPrompt) {
    // Automatically prepend language instruction to system prompt
    const languageInstruction = getSystemLanguageInstruction(context);
    const fullSystemPrompt = `${languageInstruction}\n\n${replaceTemplateVars(systemPrompt)}`;
    messages.push({ role: "system", content: fullSystemPrompt });
  }

  let userContent = "";
  if (userPromptTemplate) {
    // Automatically prepend language context to user prompt
    const languageContext = getUserLanguageContext(context);
    const templateContent = replaceTemplateVars(userPromptTemplate);
    userContent = `${languageContext}\n\n${templateContent}`;
  } else {
    userContent =
      typeof input === "string" ? input : JSON.stringify(input, null, 2);
  }

  // When using JSON response format, ensure the prompt contains the word "json"
  // This is required by OpenAI/DeepSeek APIs
  if (responseFormat === "json" && !userContent.toLowerCase().includes("json")) {
    userContent += "\n\nPlease respond in JSON format.";
  }

  messages.push({ role: "user", content: userContent });

  return messages;
}

/**
 * Parse LLM response based on format
 * Exported for use in streaming execution
 */
export async function parseResponse(
  response: unknown,
  format?: string
): Promise<unknown> {
  if (typeof response !== "string") return response;

  if (format === "json") {
    try {
      return JSON.parse(response);
    } catch {
      return { content: response };
    }
  }

  return response;
}

/**
 * Call LLM API with provider-specific handling
 */
async function callLLMAPI(request: LLMAPIRequest): Promise<unknown> {
  const {
    provider,
    apiKey,
    apiUrl,
    model,
    messages,
    temperature,
    maxTokens,
    responseFormat,
  } = request;
  // Default API URLs
  const apiUrls: Record<LLMProvider, string> = {
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
    };
  } else {
    body = {
      model: model || (provider === "deepseek" ? "deepseek-chat" : "gpt-3.5-turbo"),
      messages,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { max_tokens: maxTokens }),
      ...(responseFormat === "json" && {
        response_format: { type: "json_object" },
      }),
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
    // Sanitize error message to remove any potential API key exposure
    let sanitizedError = errorText;
    if (apiKey) {
      // Remove API key from error message if it appears
      sanitizedError = sanitizedError.replace(
        new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        '[API_KEY_HIDDEN]'
      );
      // Also remove common API key patterns
      sanitizedError = sanitizedError.replace(
        /sk-[a-zA-Z0-9]{20,}/g,
        '[API_KEY_HIDDEN]'
      );
      sanitizedError = sanitizedError.replace(
        /Bearer\s+sk-[a-zA-Z0-9]{20,}/g,
        'Bearer [API_KEY_HIDDEN]'
      );
    }
    throw new Error(`LLM API error: ${response.status} ${sanitizedError}`);
  }

  const data = await response.json();

  // Extract content based on provider
  if (provider === "anthropic") {
    return data.content?.[0]?.text || "";
  } else {
    return data.choices?.[0]?.message?.content || "";
  }
}

