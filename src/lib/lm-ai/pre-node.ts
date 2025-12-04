/**
 * Pre-processing Node implementations
 * Handles data transformation, formatting, validation before LLM calls
 */

import type { PreNode, PreNodeConfig, NodeContext, NodeResult } from "./types";

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
        case "format":
          output = await formatText(context.input, config.format);
          break;

        case "summarize":
          output = await summarizeText(context.input, config.maxLength || 1000);
          break;

        case "organize":
          output = await organizeOutput(context.input, config.format);
          break;

        case "transform-message":
          output = await transformMessage(
            context.input,
            config.targetStructure
          );
          break;

        case "validate-input":
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

        case "validate-and-transform":
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

        case "clean-vocabulary-links":
          output = await cleanVocabularyLinks(context.input);
          break;

        case "clean-invalid-vocabulary":
          output = await cleanInvalidVocabulary(context.input);
          break;

        case "clean-invalid-vocabulary-nodes":
          output = await cleanInvalidVocabularyNodes(context.input);
          break;

        case "merge-vocabulary-nodes-links":
          output = await mergeVocabularyNodesLinks(context.input, context);
          break;

        default:
          output = context.input;
      }

      return {
        success: true,
        output,
        metadata: { nodeType: "pre", nodeId: id },
      };
    } catch (error) {
      return {
        success: false,
        output: context.input,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: { nodeType: "pre", nodeId: id },
      };
    }
  };

  return {
    id,
    name,
    description,
    nodeType: "pre",
    config,
    execute,
  };
}

/**
 * Helper functions for Pre Nodes
 */
async function formatText(input: unknown, format?: string): Promise<unknown> {
  if (typeof input !== "string") return input;

  switch (format) {
    case "json":
      try {
        return JSON.parse(input);
      } catch {
        return { text: input };
      }
    case "markdown":
      return input;
    case "text":
      return input.trim();
    case "structured":
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
  if (typeof input !== "string") return input;
  if (input.length <= maxLength) return input;

  // Simple truncation - in real implementation, this could use LLM
  return input.slice(0, maxLength) + "...";
}

async function organizeOutput(
  input: unknown,
  format?: string
): Promise<unknown> {
  if (format === "json" && typeof input === "object") {
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
  if (typeof input === "object" && input !== null) {
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
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: "Input must be an object" };
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
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "array":
      return Array.isArray(value);
    case "object":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    default:
      return true;
  }
}

/**
 * Clean vocabulary links - remove links where start or end are not in nodes
 */
async function cleanVocabularyLinks(input: unknown): Promise<unknown> {
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const data = input as Record<string, unknown>;
  const nodes = (data.nodes as Array<unknown>) || [];
  const links = (data.links as Array<unknown>) || [];

  // Create a set of valid words from nodes
  const validWords = new Set<string>();
  for (const node of nodes) {
    if (typeof node === "object" && node !== null) {
      const nodeObj = node as Record<string, unknown>;
      const word = String(nodeObj.word || "").toLowerCase();
      if (word) {
        validWords.add(word);
      }
    }
  }

  // Filter links to only include those where both start and end exist in nodes
  const cleanedLinks = links.filter((link) => {
    if (typeof link !== "object" || link === null) {
      return false;
    }
    const linkObj = link as Record<string, unknown>;
    const start = String(linkObj.start || "").toLowerCase();
    const end = String(linkObj.end || "").toLowerCase();

    return validWords.has(start) && validWords.has(end);
  });

  return {
    ...data,
    links: cleanedLinks,
  };
}

/**
 * Clean invalid vocabulary nodes and links based on validation issues
 * Input should be the validation output which contains nodes, links, and issues
 */
async function cleanInvalidVocabulary(
  input: unknown,
  _validationOutput?: unknown
): Promise<unknown> {
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const data = input as Record<string, unknown>;
  let nodes = (data.nodes as Array<unknown>) || [];
  const links = (data.links as Array<unknown>) || [];
  const issues = (data.issues as Array<unknown>) || [];

  // Extract invalid node words from issues
  // Issues format: "word: issue description" or just list of invalid words
  const invalidWords = new Set<string>();
  for (const issue of issues) {
    const issueStr = String(issue || "").trim();
    if (!issueStr) continue;

    // Try to extract word from issue message (format: "word: issue description")
    if (issueStr.includes(":")) {
      const wordMatch = issueStr.match(/^([^:]+):/);
      if (wordMatch) {
        invalidWords.add(wordMatch[1].trim().toLowerCase());
      }
    } else {
      // If no colon, assume the whole string is the word
      invalidWords.add(issueStr.toLowerCase());
    }
  }

  // Remove invalid nodes
  if (invalidWords.size > 0) {
    nodes = nodes.filter((node) => {
      if (typeof node === "object" && node !== null) {
        const nodeObj = node as Record<string, unknown>;
        const word = String(nodeObj.word || "")
          .trim()
          .toLowerCase();
        return word && !invalidWords.has(word);
      }
      return true;
    });
  }

  // Clean links (remove links where start or end are not in nodes)
  const validWords = new Set<string>();
  for (const node of nodes) {
    if (typeof node === "object" && node !== null) {
      const nodeObj = node as Record<string, unknown>;
      const word = String(nodeObj.word || "")
        .trim()
        .toLowerCase();
      if (word) {
        validWords.add(word);
      }
    }
  }

  const cleanedLinks = links.filter((link) => {
    if (typeof link !== "object" || link === null) {
      return false;
    }
    const linkObj = link as Record<string, unknown>;
    const start = String(linkObj.start || "")
      .trim()
      .toLowerCase();
    const end = String(linkObj.end || "")
      .trim()
      .toLowerCase();

    return validWords.has(start) && validWords.has(end);
  });

  return {
    nodes,
    links: cleanedLinks,
  };
}

/**
 * Clean invalid vocabulary nodes only (used after vocabulary validation 1)
 */
async function cleanInvalidVocabularyNodes(input: unknown): Promise<unknown> {
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const data = input as Record<string, unknown>;
  let nodes = (data.nodes as Array<unknown>) || [];
  const issues = (data.issues as Array<unknown>) || [];

  // Extract invalid node words from issues
  const invalidWords = new Set<string>();
  for (const issue of issues) {
    const issueStr = String(issue || "").trim();
    if (!issueStr) continue;

    // Try to extract word from issue message (format: "word: issue description")
    if (issueStr.includes(":")) {
      const wordMatch = issueStr.match(/^([^:]+):/);
      if (wordMatch) {
        invalidWords.add(wordMatch[1].trim().toLowerCase());
      }
    } else {
      invalidWords.add(issueStr.toLowerCase());
    }
  }

  // Remove invalid nodes
  if (invalidWords.size > 0) {
    nodes = nodes.filter((node) => {
      if (typeof node === "object" && node !== null) {
        const nodeObj = node as Record<string, unknown>;
        const word = String(nodeObj.word || "")
          .trim()
          .toLowerCase();
        return word && !invalidWords.has(word);
      }
      return true;
    });
  }

  return {
    nodes,
  };
}

/**
 * Merge vocabulary nodes (from clean step) with links (from generation 2)
 * Then clean and complete: filter invalid links, add core topic links
 * Input is links from generation 2
 * Get nodes from clean step via flow steps passed in context
 */
async function mergeVocabularyNodesLinks(
  input: unknown,
  context: any
): Promise<unknown> {
  // Input is links from generation 2 (only links, no nodes)
  const linksData = input as Record<string, unknown>;
  let links = (linksData.links as Array<unknown>) || [];

  // Get nodes from clean step output via flow steps passed in context
  let nodes: Array<unknown> = [];

  if (context._flowSteps) {
    const cleanStep = (context._flowSteps as Array<any>).find(
      (s: any) => s.nodeId === "clean-invalid-vocabulary-pre"
    );
    if (cleanStep?.result?.output) {
      const cleanOutput = cleanStep.result.output as Record<string, unknown>;
      nodes = (cleanOutput.nodes as Array<unknown>) || [];
    }
  }

  if (nodes.length === 0) {
    throw new Error(
      "Cannot find vocabulary nodes from clean-invalid-vocabulary-pre step. Nodes are required to merge with links."
    );
  }

  // Extract core topic vocabulary from node tags (should be the same in all nodes)
  let coreTopicVocabulary = "";
  for (const node of nodes) {
    if (typeof node === "object" && node !== null) {
      const nodeObj = node as Record<string, unknown>;
      const tags = (nodeObj.tags as Array<unknown>) || [];
      if (tags.length > 0) {
        coreTopicVocabulary = String(tags[0] || "");
        break;
      }
    }
  }

  // Create set of valid words from nodes
  const validWords = new Set<string>();
  for (const node of nodes) {
    if (typeof node === "object" && node !== null) {
      const nodeObj = node as Record<string, unknown>;
      const word = String(nodeObj.word || "").trim();
      if (word) {
        validWords.add(word.toLowerCase());
      }
    }
  }

  // Remove links where start or end are not in nodes
  links = links.filter((link) => {
    if (typeof link !== "object" || link === null) {
      return false;
    }
    const linkObj = link as Record<string, unknown>;
    const start = String(linkObj.start || "")
      .trim()
      .toLowerCase();
    const end = String(linkObj.end || "")
      .trim()
      .toLowerCase();
    return validWords.has(start) && validWords.has(end);
  });

  // Find nodes that don't have any links
  const nodesWithLinks = new Set<string>();
  for (const link of links) {
    if (typeof link !== "object" || link === null) {
      continue;
    }
    const linkObj = link as Record<string, unknown>;
    const start = String(linkObj.start || "")
      .trim()
      .toLowerCase();
    const end = String(linkObj.end || "")
      .trim()
      .toLowerCase();
    nodesWithLinks.add(start);
    nodesWithLinks.add(end);
  }

  // Complete links: add nodes without links to coreTopicVocabulary
  for (const node of nodes) {
    if (typeof node === "object" && node !== null) {
      const nodeObj = node as Record<string, unknown>;
      const word = String(nodeObj.word || "").trim();
      const wordLower = word.toLowerCase();

      // Only add link if node has no links and core topic exists
      if (
        !nodesWithLinks.has(wordLower) &&
        validWords.has(wordLower) &&
        coreTopicVocabulary
      ) {
        const coreTopicLower = coreTopicVocabulary.toLowerCase();

        // Only link to core topic if it exists in nodes and is different from current word
        if (validWords.has(coreTopicLower) && wordLower !== coreTopicLower) {
          links.push({
            start: word,
            end: coreTopicVocabulary,
            relationship: "",
          });
          nodesWithLinks.add(wordLower);
        }
      }
    }
  }
  return {
    nodes,
    links,
  };
}
