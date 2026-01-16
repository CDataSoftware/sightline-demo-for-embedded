// Anthropic Claude LLM client with tool use

import { MCPTool } from "./cdata";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicResponse {
  id: string;
  content: AnthropicContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  usage: { input_tokens: number; output_tokens: number };
}

function getConfig() {
  return {
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || "",
    model: import.meta.env.VITE_ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  };
}

export function hasLLMConfig(): boolean {
  return !!getConfig().apiKey;
}

// Convert MCP tools to Anthropic tool format
export function mcpToolsToAnthropic(mcpTools: MCPTool[]): AnthropicTool[] {
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description || `Tool: ${tool.name}`,
    input_schema: tool.inputSchema || { type: "object", properties: {} },
  }));
}

// Send a message to Claude and get a response
async function sendMessage(
  messages: AnthropicMessage[],
  tools: AnthropicTool[],
  system?: string,
  logCollector?: LLMLogEntry[]
): Promise<AnthropicResponse> {
  const { apiKey, model } = getConfig();

  if (!apiKey) {
    throw new Error("Anthropic API key not configured");
  }

  const requestBody = {
    model,
    max_tokens: 4096,
    system,
    tools,
    messages,
  };

  // Log request
  const requestTimestamp = new Date();
  if (logCollector) {
    logCollector.push({
      timestamp: requestTimestamp,
      type: "request",
      data: requestBody,
    });
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const responseData = await response.json();
  const responseTimestamp = new Date();

  // Log response
  if (logCollector) {
    logCollector.push({
      timestamp: responseTimestamp,
      type: "response",
      data: responseData,
      duration: responseTimestamp.getTime() - requestTimestamp.getTime(),
    });
  }

  return responseData;
}

// Interim update types for streaming progress
export interface InterimUpdate {
  type: "thinking" | "tool_start" | "tool_complete" | "tool_error";
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  error?: string;
}

// Log entry for request/response debugging
export interface LLMLogEntry {
  timestamp: Date;
  type: "request" | "response";
  data: unknown;
  duration?: number;
}

export interface LLMDebugLogs {
  entries: LLMLogEntry[];
  totalDuration: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// Run the agentic loop: send message, execute tools, repeat until done
export async function chat(
  userMessage: string,
  conversationHistory: AnthropicMessage[],
  mcpTools: MCPTool[],
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  onInterimUpdate?: (update: InterimUpdate) => void
): Promise<{ response: string; toolCalls: { name: string; result: unknown }[]; debugLogs: LLMDebugLogs }> {
  const tools = mcpToolsToAnthropic(mcpTools);
  const toolCalls: { name: string; result: unknown }[] = [];
  const logEntries: LLMLogEntry[] = [];
  const startTime = Date.now();

  const system = `You are an AI Data Advisor, a helpful assistant that helps users understand and analyze their data. You have access to tools that let you query and explore data sources.

IMPORTANT - Federated Queries:
When the user's question involves data from multiple sources (e.g., combining Salesforce accounts with Zendesk tickets, or joining Snowflake usage data with CRM data), write a SINGLE federated SQL query that JOINs across sources. This is a key differentiator - our deterministic query engine handles the cross-source joins, not the LLM. Use the format [ConnectionName].[Schema].[Table] for cross-source queries.

Example federated query:
SELECT a.Name, a.Industry, COUNT(t.Id) as TicketCount
FROM [Salesforce1].[Salesforce].[Account] a
LEFT JOIN [Zendesk1].[Zendesk].[Tickets] t ON a.Id = t.AccountId
GROUP BY a.Name, a.Industry

Use the tools to answer user questions about their data. When you need to query data, use the queryData tool with SQL queries.
Always explain what you're doing and summarize the results in a clear, user-friendly way.`;

  // Build messages array
  const messages: AnthropicMessage[] = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  // Agentic loop
  let response = await sendMessage(messages, tools, system, logEntries);

  while (response.stop_reason === "tool_use") {
    // Extract any text thinking from the response
    const textBlocks = response.content.filter((block) => block.type === "text");
    if (textBlocks.length > 0 && onInterimUpdate) {
      const thinking = textBlocks.map((block) => block.text || "").join("\n");
      if (thinking.trim()) {
        onInterimUpdate({ type: "thinking", content: thinking });
      }
    }

    // Find tool use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is AnthropicContentBlock & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        block.type === "tool_use"
    );

    // Execute each tool
    const toolResults: AnthropicContentBlock[] = [];
    for (const toolUse of toolUseBlocks) {
      // Notify tool start
      if (onInterimUpdate) {
        onInterimUpdate({
          type: "tool_start",
          toolName: toolUse.name,
          toolInput: toolUse.input,
        });
      }

      try {
        const result = await callTool(toolUse.name, toolUse.input);
        toolCalls.push({ name: toolUse.name, result });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });

        // Notify tool complete
        if (onInterimUpdate) {
          onInterimUpdate({
            type: "tool_complete",
            toolName: toolUse.name,
            toolResult: result,
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Error: ${errorMsg}`,
        });

        // Notify tool error
        if (onInterimUpdate) {
          onInterimUpdate({
            type: "tool_error",
            toolName: toolUse.name,
            error: errorMsg,
          });
        }
      }
    }

    // Add assistant response and tool results to messages
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    // Get next response
    response = await sendMessage(messages, tools, system, logEntries);
  }

  // Extract final text response
  const textBlocks = response.content.filter((block) => block.type === "text");
  const finalResponse = textBlocks.map((block) => block.text || "").join("\n");

  // Calculate totals from log entries
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  for (const entry of logEntries) {
    if (entry.type === "response") {
      const responseData = entry.data as AnthropicResponse;
      if (responseData.usage) {
        totalInputTokens += responseData.usage.input_tokens;
        totalOutputTokens += responseData.usage.output_tokens;
      }
    }
  }

  const debugLogs: LLMDebugLogs = {
    entries: logEntries,
    totalDuration: Date.now() - startTime,
    totalInputTokens,
    totalOutputTokens,
  };

  return { response: finalResponse, toolCalls, debugLogs };
}
