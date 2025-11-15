/**
 * Next.js API Route for LLM calls
 * Keeps API keys secure on the server side using HTTP-only cookies
 * 
 * NOTE: This endpoint is currently UNUSED. All LLM calls are handled through
 * the flow system via /api/flow/execute. This endpoint is kept for potential
 * standalone LLM API calls outside of the flow system.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { LLMProvider, LLMAPIRequest } from '@/lib/lm-ai/types';

const COOKIE_NAME = 'ai-api-key';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      provider,
      apiUrl,
      model,
      messages,
      temperature,
      maxTokens,
      responseFormat,
    } = body as Omit<LLMAPIRequest, 'apiKey'>;

    // Validate required fields
    if (!provider || !messages) {
      return NextResponse.json(
        { error: 'Provider and messages are required' },
        { status: 400 }
      );
    }

    // Get API key from HTTP-only cookie or environment variables
    const cookieApiKey = request.cookies.get(COOKIE_NAME)?.value;
    const finalApiKey = cookieApiKey || getApiKeyForProvider(provider);
    
    if (!finalApiKey && provider !== 'custom') {
      return NextResponse.json(
        { 
          error: 'API_KEY_MISSING',
          message: 'API key not configured. Please fill in your API key in AI Settings.',
        },
        { status: 401 }
      );
    }

    // Call LLM API
    const response = await callLLMAPI({
      provider,
      apiKey: finalApiKey,
      apiUrl,
      model,
      messages,
      temperature,
      maxTokens,
      responseFormat,
    });

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
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
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Get API key from environment variables
 */
function getApiKeyForProvider(provider: LLMProvider): string | undefined {
  switch (provider) {
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Call LLM API with provider-specific handling
 */
export async function callLLMAPI(
  request: LLMAPIRequest
): Promise<unknown> {
  const { provider, apiKey, apiUrl, model, messages, temperature, maxTokens, responseFormat } = request;

  // Default API URLs
  const apiUrls: Record<LLMProvider, string> = {
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
    custom: apiUrl || '',
  };

  const url = apiUrl || apiUrls[provider];
  if (!url) {
    throw new Error(`No API URL configured for provider: ${provider}`);
  }

  // Prepare request body based on provider
  let body: Record<string, unknown>;
  
  if (provider === 'anthropic') {
    body = {
      model: model || 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens || 4096,
      messages,
      ...(temperature !== undefined && { temperature }),
    };
  } else {
    body = {
      model: model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo'),
      messages,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { max_tokens: maxTokens }),
      ...(responseFormat === 'json' && { response_format: { type: 'json_object' } }),
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  const response = await fetch(url, {
    method: 'POST',
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
  if (provider === 'anthropic') {
    return data.content?.[0]?.text || '';
  } else {
    return data.choices?.[0]?.message?.content || '';
  }
}

