/**
 * Pre-processing Node implementations
 * Handles data transformation, formatting, validation before LLM calls
 */

import type {
  PreNode,
  PreNodeConfig,
  NodeContext,
  NodeResult,
} from './types';

/**
 * Create a Pre Node
 */
export function createPreNode(
  id: string,
  name: string,
  config: PreNodeConfig,
  description?: string
): PreNode {
  const execute = async (context: NodeContext): Promise<NodeResult> => {
    try {
      let output: unknown = context.input;

      switch (config.type) {
        case 'format':
          output = await formatText(context.input, config.format);
          break;

        case 'summarize':
          output = await summarizeText(
            context.input,
            config.maxLength || 1000
          );
          break;

        case 'organize':
          output = await organizeOutput(context.input, config.format);
          break;

        case 'transform-message':
          output = await transformMessage(
            context.input,
            config.targetStructure
          );
          break;

        case 'validate-input':
          const validationResult = await validateInput(
            context.input,
            config.validationRules || []
          );
          if (!validationResult.valid) {
            return {
              success: false,
              output: context.input,
              error: validationResult.error,
            };
          }
          output = context.input;
          break;

        case 'validate-and-transform':
          // First validate
          const validateResult = await validateInput(
            context.input,
            config.validationRules || []
          );
          if (!validateResult.valid) {
            return {
              success: false,
              output: context.input,
              error: validateResult.error,
            };
          }
          // Then transform
          output = await transformMessage(
            context.input,
            config.targetStructure
          );
          break;

        default:
          output = context.input;
      }

      return {
        success: true,
        output,
        metadata: { nodeType: 'pre', nodeId: id },
      };
    } catch (error) {
      return {
        success: false,
        output: context.input,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { nodeType: 'pre', nodeId: id },
      };
    }
  };

  return {
    id,
    name,
    description,
    nodeType: 'pre',
    config,
    execute,
  };
}

/**
 * Helper functions for Pre Nodes
 */
async function formatText(
  input: unknown,
  format?: string
): Promise<unknown> {
  if (typeof input !== 'string') return input;

  switch (format) {
    case 'json':
      try {
        return JSON.parse(input);
      } catch {
        return { text: input };
      }
    case 'markdown':
      return input;
    case 'text':
      return input.trim();
    case 'structured':
      // Try to extract structured data from text
      return { content: input, structured: false };
    default:
      return input;
  }
}

async function summarizeText(
  input: unknown,
  maxLength: number
): Promise<unknown> {
  if (typeof input !== 'string') return input;
  if (input.length <= maxLength) return input;

  // Simple truncation - in real implementation, this could use LLM
  return input.slice(0, maxLength) + '...';
}

async function organizeOutput(
  input: unknown,
  format?: string
): Promise<unknown> {
  if (format === 'json' && typeof input === 'object') {
    return JSON.stringify(input, null, 2);
  }
  return input;
}

async function transformMessage(
  input: unknown,
  targetStructure?: Record<string, unknown>
): Promise<unknown> {
  if (!targetStructure) return input;

  // Transform input to match target structure
  if (typeof input === 'object' && input !== null) {
    const transformed: Record<string, unknown> = {};
    for (const [key, defaultValue] of Object.entries(targetStructure)) {
      transformed[key] =
        (input as Record<string, unknown>)[key] ?? defaultValue;
    }
    return transformed;
  }

  return input;
}

async function validateInput(
  input: unknown,
  rules: Array<{
    field: string;
    required?: boolean;
    type?: string;
    validator?: (value: unknown) => boolean;
  }>
): Promise<{ valid: boolean; error?: string }> {
  if (typeof input !== 'object' || input === null) {
    return { valid: false, error: 'Input must be an object' };
  }

  const obj = input as Record<string, unknown>;

  for (const rule of rules) {
    const value = obj[rule.field];

    if (rule.required && (value === undefined || value === null)) {
      return {
        valid: false,
        error: `Field ${rule.field} is required`,
      };
    }

    if (value !== undefined && rule.type) {
      const typeCheck = checkType(value, rule.type);
      if (!typeCheck) {
        return {
          valid: false,
          error: `Field ${rule.field} must be of type ${rule.type}`,
        };
      }
    }

    if (value !== undefined && rule.validator && !rule.validator(value)) {
      return {
        valid: false,
        error: `Field ${rule.field} failed validation`,
      };
    }
  }

  return { valid: true };
}

function checkType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

