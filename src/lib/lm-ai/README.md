# Learning Language Agent Flow System

## Architecture

The flow system is now **fully server-side** for security and better control:

- **Server**: All AI logic runs on the server (API routes)
- **Client**: Only manages UI state and user interactions
- **Streaming**: Real-time updates via Server-Sent Events (SSE)
- **Control**: Pause, resume, confirm, retry from client

## Usage

### Client-Side Hook

```tsx
'use client';

import { useFlowController } from '@/hooks/useFlowController';

function DialogPage() {
  const {
    state,
    status,
    isRunning,
    isWaitingConfirmation,
    currentStep,
    events,
    execute,
    pause,
    resume,
    confirm,
    reject,
    retry,
  } = useFlowController({
    flowId: 'simulate-dialog',
    confirmationNodes: ['dialog-check'], // Pause for user confirmation
    continueOnFailure: true, // Continue with input on failure
    onEvent: (event) => {
      console.log('Flow event:', event);
    },
    onStateChange: (state) => {
      console.log('Flow state:', state);
    },
  });

  const handleStart = async () => {
    await execute({
      situation: 'Ordering food at a restaurant',
      characterA: 'Customer',
      characterB: 'Waiter',
    });
  };

  return (
    <div>
      <button onClick={handleStart} disabled={isRunning}>
        Start Dialog
      </button>
      
      {isWaitingConfirmation && (
        <div>
          <p>Review the dialog:</p>
          <pre>{JSON.stringify(state?.steps[currentStep]?.result?.output, null, 2)}</pre>
          <button onClick={() => confirm()}>Confirm</button>
          <button onClick={() => reject()}>Reject</button>
          <button onClick={() => skip()}>Skip</button>
        </div>
      )}

      {status === 'error' && (
        <div>
          <p>Error: {state?.error}</p>
          <button onClick={retry}>Retry</button>
        </div>
      )}

      <div>
        <h3>Flow Status: {status}</h3>
        <p>Current Step: {currentStep + 1} / {state?.steps.length}</p>
      </div>
    </div>
  );
}
```

### Flow Configuration

Flows can be configured with:

- **confirmationNodes**: Node IDs that require user confirmation
- **continueOnFailure**: Continue with input if a step fails
- **conditions**: Conditional routing based on results

```typescript
const flow = createSimulateDialogFlow(
  { provider: 'deepseek' },
  {
    confirmationNodes: ['dialog-check', 'dialog-audio'],
    continueOnFailure: true,
  }
);
```

### Flow Control Actions

- **pause()**: Pause execution
- **resume()**: Resume from pause
- **confirm()**: Confirm and proceed (when waiting for confirmation)
- **reject()**: Reject current result
- **skip()**: Skip confirmation
- **retry()**: Retry current step

### Events

The hook provides real-time events:

- `step-start`: Node execution started
- `step-complete`: Node execution completed
- `step-error`: Node execution failed
- `status-change`: Flow status changed
- `confirmation-required`: Waiting for user confirmation

## API Routes

### POST /api/flow/execute

Execute a flow with streaming response.

**Request:**
```json
{
  "flowId": "simulate-dialog",
  "input": { "situation": "..." },
  "context": { "learningLanguage": "english" },
  "confirmationNodes": ["dialog-check"],
  "continueOnFailure": true
}
```

**Response:** Server-Sent Events stream

### POST /api/flow/control

Control flow execution.

**Request:**
```json
{
  "sessionId": "flow_123...",
  "action": "pause" | "resume" | "confirm" | "reject" | "skip" | "retry",
  "data": {}
}
```

### GET /api/flow/control?sessionId=...

Get current flow state.

## Benefits

1. **Security**: API keys never exposed to client
2. **Control**: Easy pause/resume/confirm from UI
3. **Streaming**: Real-time updates
4. **Error Handling**: Continue on failure option
5. **User Interaction**: Confirmation points for review
6. **State Management**: Server tracks all sessions

