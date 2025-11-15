/**
 * API Route for flow execution with streaming
 */

import { NextRequest } from "next/server";
import type {
  FlowExecutionRequest,
  FlowConfig,
  NodeContext,
} from "@/lib/lm-ai/types";
import {
  executeFlowStream,
  resumeFlowStream,
  getFlowState,
  getSessionManager,
} from "@/lib/lm-ai/server-flow";
import {
  createSimulateDialogFlow,
  createExtendVocabularyFlow,
  createSimpleChatFlow,
} from "@/lib/lm-ai/flow";

const COOKIE_NAME = "ai-api-key";

// Flow registry
const flowRegistry: Record<string, () => FlowConfig> = {
  "simulate-dialog": () => {
    const flow = createSimulateDialogFlow();
    return flow.getState().config;
  },
  "extend-vocabulary": () => {
    const flow = createExtendVocabularyFlow();
    return flow.getState().config;
  },
  chat: () => {
    const flow = createSimpleChatFlow();
    return flow.getState().config;
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FlowExecutionRequest;
    const { flowId, input, context, sessionId, startIndex, partialState } =
      body;

    // If sessionId is provided, check if we should resume or start new
    if (sessionId) {
      // If starting with partialState/startIndex, close current workflow and start new one
      // This makes the API easier - client can pass sessionId to close it, then start new
      if (partialState !== undefined || startIndex !== undefined) {
        // Close the existing workflow (like reject) and start new one
        // This makes the API easier - client can pass sessionId to close it, then start new
        const existingState = getFlowState(sessionId);
        if (existingState) {
          // Only close if it exists and is still active
          const sessionManager = getSessionManager();
          const session = sessionManager.getSession(sessionId);
          if (session) {
            session.flow.setStatus("completed");
            sessionManager.updateSession(sessionId, {
              status: "completed",
              waitingForOperation: undefined,
            });
          }
        }
        // Continue below to start NEW workflow with partialState/startIndex
      } else {
        // Resume existing session (no partialState/startIndex)
        const existingState = getFlowState(sessionId);
        if (!existingState) {
          // Session was cleaned up - cannot resume. User needs to start a new workflow.
          return new Response(
            JSON.stringify({
              error: `Session not found: ${sessionId}`,
              hint: "The session was cleaned up. Please start a new workflow by calling execute without a sessionId.",
            }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }

        // Resume execution from existing session
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();

            try {
              for await (const event of resumeFlowStream(sessionId)) {
                const data = JSON.stringify(event) + "\n";
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }

              controller.close();
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
              const errorData = JSON.stringify({
                type: "error",
                error: errorMessage,
                message: errorMessage,
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
    }

    // Get flow config
    const getFlowConfig = flowRegistry[flowId];
    if (!getFlowConfig) {
      return new Response(
        JSON.stringify({ error: `Flow not found: ${flowId}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const flowConfig = getFlowConfig();

    if (body.continueOnFailure !== undefined) {
      flowConfig.continueOnFailure = body.continueOnFailure;
    }

    // Get API key from HTTP-only cookie
    const cookieApiKey = request.cookies.get(COOKIE_NAME)?.value;

    // Check if API key is required (if flow has LLM nodes)
    const hasLLMNodes = flowConfig.nodes.some(
      (node) => node.nodeType === "llm"
    );
    if (hasLLMNodes && !cookieApiKey) {
      // Check if any LLM node requires an API key (not custom provider)
      const needsApiKey = flowConfig.nodes.some((node) => {
        if (node.nodeType !== "llm") return false;
        // If aiConfig is provided, use that provider, otherwise use node's default
        const provider =
          body.aiConfig?.provider || node.config.provider || "deepseek";
        return provider !== "custom";
      });

      if (needsApiKey) {
        return new Response(
          JSON.stringify({
            error: "API_KEY_MISSING",
            message:
              "API key not configured. Please fill in your API key in AI Settings.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Extract API credentials from request (cookie + aiConfig)
    // NEVER store apiKey in node configs - pass it to executeFlowStream instead
    const apiKey = cookieApiKey;
    const providerOverride = body.aiConfig?.provider;
    const modelOverride = body.aiConfig?.model;
    const apiUrlOverride = body.aiConfig?.apiUrl;

    // Start NEW workflow (no sessionId provided)
    // If partialState/startIndex are provided, this is restarting from a previous workflow
    // (e.g., from extend/retry actions)

    // Prepare context
    // If partialState is provided (from previous workflow), node can access it via context
    const nodeContext: NodeContext = {
      input,
      ...context,
      // Pass partialState in context so nodes can access previous workflow state if needed
      // This is a NEW workflow, but it references state from a previous workflow
      ...(partialState ? { _partialState: partialState } : {}),
    };

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // If startIndex is provided, start execution from that step (for extend/retry)
          // This is a general workflow feature - can start any workflow at any step
          // Pass API credentials directly - never store in node configs
          for await (const event of executeFlowStream(
            flowConfig,
            nodeContext,
            undefined,
            startIndex,
            apiKey,
            providerOverride,
            modelOverride,
            apiUrlOverride
          )) {
            const data = JSON.stringify(event) + "\n";
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          controller.close();
        } catch (error) {
          let errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          
          // Sanitize error message to remove any potential API key exposure
          const cookieApiKey = request.cookies.get(COOKIE_NAME)?.value;
          if (cookieApiKey) {
            errorMessage = errorMessage.replace(
              new RegExp(cookieApiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
              '[API_KEY_HIDDEN]'
            );
            errorMessage = errorMessage.replace(
              /sk-[a-zA-Z0-9]{20,}/g,
              '[API_KEY_HIDDEN]'
            );
            errorMessage = errorMessage.replace(
              /Bearer\s+sk-[a-zA-Z0-9]{20,}/g,
              'Bearer [API_KEY_HIDDEN]'
            );
          }
          
          // Check if it's an API key missing error
          const isApiKeyMissing =
            errorMessage.includes("API key") ||
            errorMessage.includes("API_KEY_MISSING");
          const errorData = JSON.stringify({
            type: "error",
            error: isApiKeyMissing ? "API_KEY_MISSING" : errorMessage,
            message: isApiKeyMissing
              ? "API key not configured. Please fill in your API key in AI Settings."
              : errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
