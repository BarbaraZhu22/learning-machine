/**
 * API endpoint to securely store AI configuration
 * Stores API key in HTTP-only cookie to prevent XSS attacks
 */

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'ai-api-key';

// Calculate max age in seconds from days
function getCookieMaxAge(days: number): number {
  return 60 * 60 * 24 * days;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey, apiUrl, model, expirationDays } = body;

    // Validate required fields
    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Only store API key if provided and provider is not custom
    if (!apiKey && provider !== 'custom') {
      return NextResponse.json(
        { error: 'API key is required for this provider' },
        { status: 400 }
      );
    }

    // Create response
    const response = NextResponse.json({ 
      success: true,
      message: 'AI configuration saved',
      config: {
        provider,
        apiUrl,
        model,
        // Don't return apiKey in response
      }
    });

    // Set HTTP-only cookie with API key
    if (apiKey) {
      // Default to 30 days if not specified, validate allowed values
      const allowedDays = [15, 30, 60, 365];
      const days = allowedDays.includes(expirationDays) ? expirationDays : 30;
      const maxAge = getCookieMaxAge(days);
      
      response.cookies.set(COOKIE_NAME, apiKey, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // 'lax' allows same-site requests, more flexible than 'strict'
        maxAge, // Set based on user selection
        path: '/',
      });
    } else {
      // Clear cookie if no API key provided
      response.cookies.delete(COOKIE_NAME);
    }

    return response;
  } catch (error) {
    console.error('AI config save error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({ 
      success: true,
      message: 'AI configuration cleared'
    });

    // Clear the cookie
    response.cookies.delete(COOKIE_NAME);

    return response;
  } catch (error) {
    console.error('AI config clear error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


