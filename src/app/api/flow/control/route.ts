/**
 * API Route for flow control (pause, resume, confirm, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import type { FlowControlRequest } from '@/lib/lm-ai/types';
import { controlFlow, getFlowState } from '@/lib/lm-ai/server-flow';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FlowControlRequest;
    const { sessionId, action, data } = body;

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'Session ID and action are required' },
        { status: 400 }
      );
    }

    const state = await controlFlow(sessionId, action, data);

    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get flow state
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const state = getFlowState(sessionId);

    if (!state) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

