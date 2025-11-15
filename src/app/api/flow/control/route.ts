/**
 * API Route for flow control (pause, resume, confirm, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import type { FlowControlRequest } from "@/lib/lm-ai/types";
import { controlFlow, getFlowState } from "@/lib/lm-ai/server-flow";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: FlowControlRequest;
    try {
      body = (await request.json()) as FlowControlRequest;
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { sessionId, action, data } = body;

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: "Session ID and action are required" },
        { status: 400 }
      );
    }

    // Call controlFlow directly - it will handle session validation
    // For restart action, it will move currentStepIndex back and update context
    const { operationAction } = body;
    const state = await controlFlow(sessionId, action, data, operationAction);

    // Return response - ensure state is serializable
    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error) {
    // Ensure error response is always returned
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    // Check if it's a session not found error and return 404 instead of 500
    if (errorMessage.includes("Session not found")) {
      return NextResponse.json(
        {
          error: errorMessage,
          // Provide helpful context for debugging
          hint: "The session may have been cleaned up. Make sure the workflow was started and the sessionId is correct.",
        },
        { status: 404 }
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
 * Get flow state
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const state = getFlowState(sessionId);

    if (!state) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
