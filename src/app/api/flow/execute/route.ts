/**
 * API Route for flow execution with streaming
 */

import { NextRequest } from 'next/server';
import type {
  FlowExecutionRequest,
  FlowConfig,
  NodeContext,
} from '@/lib/lm-ai/types';
import { executeFlowStream } from '@/lib/lm-ai/server-flow';
import { createSimulateDialogFlow, createExtendVocabularyFlow } from '@/lib/lm-ai/flow';

const COOKIE_NAME = 'ai-api-key';

// Flow registry
const flowRegistry: Record<string, () => FlowConfig> = {
  'simulate-dialog': () => {
    const flow = createSimulateDialogFlow();
    return flow.getState().config;
  },
  'extend-vocabulary': () => {
    const flow = createExtendVocabularyFlow();
    return flow.getState().config;
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FlowExecutionRequest;
    const { flowId, input, context } = body;

    // Get flow config
    const getFlowConfig = flowRegistry[flowId];
    if (!getFlowConfig) {
      return new Response(
        JSON.stringify({ error: `Flow not found: ${flowId}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const flowConfig = getFlowConfig();
    
    // Merge confirmation nodes if needed
    if (body.confirmationNodes) {
      flowConfig.confirmationNodes = body.confirmationNodes;
    }
    
    if (body.continueOnFailure !== undefined) {
      flowConfig.continueOnFailure = body.continueOnFailure;
    }

    // Get API key from HTTP-only cookie
    const cookieApiKey = request.cookies.get(COOKIE_NAME)?.value;

    // Check if API key is required (if flow has LLM nodes)
    const hasLLMNodes = flowConfig.nodes.some((node) => node.nodeType === 'llm');
    if (hasLLMNodes && !cookieApiKey) {
      // Check if any LLM node requires an API key (not custom provider)
      const needsApiKey = flowConfig.nodes.some(
        (node) => {
          if (node.nodeType !== 'llm') return false;
          // If aiConfig is provided, use that provider, otherwise use node's default
          const provider = body.aiConfig?.provider || node.config.provider || 'deepseek';
          return provider !== 'custom';
        }
      );
      
      if (needsApiKey) {
        return new Response(
          JSON.stringify({
            error: 'API_KEY_MISSING',
            message: 'API key not configured. Please fill in your API key in AI Settings.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Apply user-provided AI config to all LLM nodes
    // Note: apiKey is now read from cookie, not from request body
    if (body.aiConfig) {
      flowConfig.nodes.forEach((node) => {
        if (node.nodeType === 'llm') {
          node.config.provider = body.aiConfig!.provider as 'deepseek' | 'openai' | 'anthropic' | 'custom';
          // Use API key from cookie if available, otherwise fall back to env vars
          node.config.apiKey = cookieApiKey;
          if (body.aiConfig!.apiUrl) {
            node.config.apiUrl = body.aiConfig!.apiUrl;
          }
          if (body.aiConfig!.model) {
            node.config.model = body.aiConfig!.model;
          }
        }
      });
    } else if (cookieApiKey) {
      // If no aiConfig provided but cookie exists, apply cookie to all LLM nodes
      flowConfig.nodes.forEach((node) => {
        if (node.nodeType === 'llm') {
          node.config.apiKey = cookieApiKey;
        }
      });
    }

    // Prepare context
    const nodeContext: NodeContext = {
      input,
      ...context,
    };

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          for await (const event of executeFlowStream(flowConfig, nodeContext)) {
            const data = JSON.stringify(event) + '\n';
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          // Check if it's an API key missing error
          const isApiKeyMissing = errorMessage.includes('API key') || errorMessage.includes('API_KEY_MISSING');
          const errorData = JSON.stringify({
            type: 'error',
            error: isApiKeyMissing ? 'API_KEY_MISSING' : errorMessage,
            message: isApiKeyMissing ? 'API key not configured. Please fill in your API key in AI Settings.' : errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

