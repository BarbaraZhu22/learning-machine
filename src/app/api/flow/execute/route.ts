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

    // Apply user-provided AI config to all LLM nodes
    if (body.aiConfig) {
      flowConfig.nodes.forEach((node) => {
        if (node.nodeType === 'llm') {
          node.config.provider = body.aiConfig!.provider as 'deepseek' | 'openai' | 'anthropic' | 'custom';
          node.config.apiKey = body.aiConfig!.apiKey;
          if (body.aiConfig!.apiUrl) {
            node.config.apiUrl = body.aiConfig!.apiUrl;
          }
          if (body.aiConfig!.model) {
            node.config.model = body.aiConfig!.model;
          }
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
          const errorData = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
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

