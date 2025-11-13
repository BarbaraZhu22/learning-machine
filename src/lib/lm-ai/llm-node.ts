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
      const input = context.previousOutput || context.input;

      // Transform input to message structure based on provider
      const messages = await prepareMessages(
        input,
        config.userPromptTemplate,
        config.systemPrompt
      );

      // Direct API call (nodes only run server-side)
      const response = await callLLMAPI({
        provider,
        apiKey: config.apiKey,
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
  };
}

/**
 * Prepare messages for LLM API based on provider
 */
async function prepareMessages(
  input: unknown,
  userPromptTemplate?: string,
  systemPrompt?: string
): Promise<Array<{ role: string; content: string }>> {
  const messages: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  let userContent = "";
  if (userPromptTemplate) {
    const inputStr =
      typeof input === "string" ? input : JSON.stringify(input, null, 2);
    userContent = userPromptTemplate.replace("{{input}}", inputStr);
  } else {
    userContent =
      typeof input === "string" ? input : JSON.stringify(input, null, 2);
  }

  messages.push({ role: "user", content: userContent });

  return messages;
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
      model: model || (provider === "deepseek" ? "deepseek-chat" : "gpt-4"),
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
    throw new Error(`LLM API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // Extract content based on provider
  if (provider === "anthropic") {
    return data.content?.[0]?.text || data.content?.[0]?.text || "";
  } else {
    return data.choices?.[0]?.message?.content || "";
  }
}

/**
 * Parse LLM response based on format
 */
async function parseResponse(
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
