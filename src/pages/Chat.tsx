import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, BarChart3, TrendingUp, Users, AlertCircle, Wrench, Brain, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, Bookmark, Code, Download, ListChecks, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCData } from "@/contexts/CDataContext";
import { useSavedPrompts } from "@/contexts/SavedPromptsContext";
import { useSavedQueries } from "@/contexts/SavedQueriesContext";
import { chat, hasLLMConfig, InterimUpdate, LLMDebugLogs } from "@/lib/llm";
import { SavedPromptsPanel } from "@/components/chat/SavedPromptsPanel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ProcessingStep {
  id: string;
  type: "thinking" | "tool_start" | "tool_complete" | "tool_error";
  content?: string;
  toolName?: string;
  status: "pending" | "complete" | "error";
}

interface ExtractedQuery {
  sql: string;
  toolName: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: { name: string; result: unknown; input?: Record<string, unknown> }[];
  debugLogs?: LLMDebugLogs;
  processingSteps?: ProcessingStep[];
  extractedQueries?: ExtractedQuery[];
}

interface ThinkingStep {
  id: string;
  type: InterimUpdate["type"];
  content?: string;
  toolName?: string;
  status: "pending" | "complete" | "error";
}

const suggestedQueries = [
  { icon: BarChart3, text: "What data sources do I have access to?" },
  { icon: TrendingUp, text: "Show me the tables in my database" },
  { icon: Users, text: "What columns are in the Orders table?" },
];

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hello! I'm your AI Data Advisor. Ask me anything about your data and I'll query it for you. I can explore your schemas, run queries, and help you understand your data.",
    timestamp: new Date(),
  },
];

// Component to show processing steps and/or raw logs with toggle
function MessageProcessingDetails({
  processingSteps,
  debugLogs,
  extractedQueries,
  messageId,
  onDownloadLogs,
  onSaveQuery,
  isQuerySaved,
}: {
  processingSteps?: ProcessingStep[];
  debugLogs?: LLMDebugLogs;
  extractedQueries?: ExtractedQuery[];
  messageId: string;
  onDownloadLogs: (logs: LLMDebugLogs, id: string) => void;
  onSaveQuery: (sql: string) => void;
  isQuerySaved: (sql: string) => boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"steps" | "queries" | "raw">(
    extractedQueries && extractedQueries.length > 0 ? "queries" : processingSteps ? "steps" : "raw"
  );

  const hasSteps = processingSteps && processingSteps.length > 0;
  const hasLogs = debugLogs && debugLogs.entries.length > 0;
  const hasQueries = extractedQueries && extractedQueries.length > 0;

  if (!hasSteps && !hasLogs && !hasQueries) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {viewMode === "queries" ? (
            <Save className="h-3 w-3" />
          ) : viewMode === "steps" ? (
            <ListChecks className="h-3 w-3" />
          ) : (
            <Code className="h-3 w-3" />
          )}
          <span>View processing details</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded">
            {hasQueries ? `${extractedQueries.length} ${extractedQueries.length === 1 ? "query" : "queries"}` :
             hasSteps ? `${processingSteps.length} steps` : `${debugLogs?.entries.length} entries`}
          </span>
        </CollapsibleTrigger>
        {hasLogs && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDownloadLogs(debugLogs, messageId);
            }}
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        )}
      </div>
      <CollapsibleContent className="mt-2">
        {/* View mode toggle - show if we have multiple view types */}
        {((hasQueries ? 1 : 0) + (hasSteps ? 1 : 0) + (hasLogs ? 1 : 0)) > 1 && (
          <div className="flex gap-1 mb-2">
            {hasQueries && (
              <button
                onClick={() => setViewMode("queries")}
                className={cn(
                  "text-[10px] px-2 py-1 rounded transition-colors",
                  viewMode === "queries"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Save className="h-3 w-3 inline mr-1" />
                Queries
              </button>
            )}
            {hasSteps && (
              <button
                onClick={() => setViewMode("steps")}
                className={cn(
                  "text-[10px] px-2 py-1 rounded transition-colors",
                  viewMode === "steps"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <ListChecks className="h-3 w-3 inline mr-1" />
                Steps
              </button>
            )}
            {hasLogs && (
              <button
                onClick={() => setViewMode("raw")}
                className={cn(
                  "text-[10px] px-2 py-1 rounded transition-colors",
                  viewMode === "raw"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Code className="h-3 w-3 inline mr-1" />
                Raw Logs
              </button>
            )}
          </div>
        )}

        {/* Queries view */}
        {viewMode === "queries" && hasQueries && (
          <div className="space-y-2">
            {extractedQueries.map((query, idx) => {
              const saved = isQuerySaved(query.sql);
              return (
                <div key={idx} className="rounded border border-border bg-muted/30 overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1 bg-muted/50 border-b border-border">
                    <span className="text-[10px] text-muted-foreground">
                      via {query.toolName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-5 px-2 text-[10px]",
                        saved ? "text-green-500" : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => !saved && onSaveQuery(query.sql)}
                      disabled={saved}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {saved ? "Saved" : "Save to Explorer"}
                    </Button>
                  </div>
                  <pre className="p-2 text-[10px] text-foreground/80 whitespace-pre-wrap overflow-x-auto max-h-[150px]">
                    {query.sql}
                  </pre>
                </div>
              );
            })}
          </div>
        )}

        {/* Processing steps view */}
        {viewMode === "steps" && hasSteps && (
          <div className="space-y-1.5 pl-1">
            {processingSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 text-xs">
                {step.type === "thinking" ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    <span className="text-muted-foreground italic">{step.content}</span>
                  </>
                ) : (
                  <>
                    {step.status === "complete" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span className="text-muted-foreground">
                      Called {step.toolName}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Raw logs view */}
        {viewMode === "raw" && hasLogs && (
          <>
            <div className="text-[10px] text-muted-foreground mb-2 flex gap-3">
              <span>Duration: {debugLogs.totalDuration}ms</span>
              <span>In: {debugLogs.totalInputTokens} tokens</span>
              <span>Out: {debugLogs.totalOutputTokens} tokens</span>
            </div>
            <div className="max-h-[300px] overflow-auto rounded border border-border bg-muted/30">
              <pre className="p-2 text-[10px] text-foreground/80 whitespace-pre-wrap break-all">
                {JSON.stringify(debugLogs.entries.map(e => ({
                  ...e,
                  timestamp: e.timestamp.toISOString(),
                })), null, 2)}
              </pre>
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Chat() {
  const { isConfigured, isLoading: isAuthLoading, error: authError, callTool, tools } = useCData();
  const { savePrompt, isPromptSaved } = useSavedPrompts();
  const { saveQuery, isQuerySaved } = useSavedQueries();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const thinkingStepsRef = useRef<ThinkingStep[]>([]);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [savedPromptsOpen, setSavedPromptsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLLMConfigured = hasLLMConfig();
  const isReady = isConfigured && isLLMConfigured;

  // Auto-scroll to bottom when new content appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingSteps]);

  const handleSend = async () => {
    if (!input.trim() || !isReady) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);
    setThinkingSteps([]);
    thinkingStepsRef.current = [];

    // Handler for interim updates - also updates ref for capturing in final message
    const handleInterimUpdate = (update: InterimUpdate) => {
      setThinkingSteps((prev) => {
        const stepId = `${update.type}-${Date.now()}`;
        let newSteps: ThinkingStep[];

        if (update.type === "thinking") {
          newSteps = [...prev, {
            id: stepId,
            type: update.type,
            content: update.content,
            status: "complete" as const,
          }];
        } else if (update.type === "tool_start") {
          newSteps = [...prev, {
            id: stepId,
            type: update.type,
            toolName: update.toolName,
            status: "pending" as const,
          }];
        } else if (update.type === "tool_complete" || update.type === "tool_error") {
          // Update the last pending tool step
          newSteps = [...prev];
          for (let i = newSteps.length - 1; i >= 0; i--) {
            if (newSteps[i].toolName === update.toolName && newSteps[i].status === "pending") {
              newSteps[i] = {
                ...newSteps[i],
                status: update.type === "tool_complete" ? "complete" : "error",
              };
              break;
            }
          }
        } else {
          newSteps = prev;
        }

        // Keep ref in sync for capturing in final message
        thinkingStepsRef.current = newSteps;
        return newSteps;
      });
    };

    try {
      // Build conversation history for context (exclude tool calls for simplicity)
      const history = messages
        .filter((m) => m.id !== "1") // Exclude initial greeting
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      // Call the agentic chat loop with interim updates
      const { response, toolCalls, debugLogs } = await chat(userInput, history, tools, callTool, handleInterimUpdate);

      // Convert ThinkingStep to ProcessingStep for storage
      const processingSteps: ProcessingStep[] = thinkingStepsRef.current.map(step => ({
        id: step.id,
        type: step.type,
        content: step.content,
        toolName: step.toolName,
        status: step.status,
      }));

      // Extract SQL queries from debug logs (look for queryData tool calls)
      const extractedQueries: ExtractedQuery[] = [];
      if (debugLogs) {
        for (const entry of debugLogs.entries) {
          if (entry.type === "request" && entry.data) {
            const requestData = entry.data as { messages?: Array<{ content?: Array<{ type: string; name?: string; input?: { query?: string } }> }> };
            // Look through messages for tool_use blocks
            for (const msg of requestData.messages || []) {
              if (Array.isArray(msg.content)) {
                for (const block of msg.content) {
                  if (block.type === "tool_use" && block.name === "queryData" && block.input?.query) {
                    extractedQueries.push({
                      sql: block.input.query,
                      toolName: block.name,
                    });
                  }
                }
              }
            }
          }
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        debugLogs,
        processingSteps: processingSteps.length > 0 ? processingSteps : undefined,
        extractedQueries: extractedQueries.length > 0 ? extractedQueries : undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setThinkingSteps([]);
    }
  };

  const handleSuggestedQuery = (query: string) => {
    setInput(query);
  };

  const handleRunSavedPrompt = (content: string) => {
    setInput(content);
    // Optionally auto-send the prompt
    // We'll just populate the input and let user review/send
  };

  const handleDownloadLogs = (debugLogs: LLMDebugLogs, messageId: string) => {
    const logData = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalDuration: `${debugLogs.totalDuration}ms`,
        totalInputTokens: debugLogs.totalInputTokens,
        totalOutputTokens: debugLogs.totalOutputTokens,
        totalRequests: debugLogs.entries.filter(e => e.type === "request").length,
      },
      entries: debugLogs.entries.map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-logs-${messageId}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex animate-fade-in">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">AI Data Advisor</h1>
            {isAuthLoading ? (
              <p className="text-sm text-muted-foreground">Connecting...</p>
            ) : (
              <Collapsible open={toolsExpanded} onOpenChange={setToolsExpanded}>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <span>{tools.length} tools available</span>
                  {toolsExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {tools.map((tool) => (
                      <span
                        key={tool.name}
                        className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md"
                        title={tool.description}
                      >
                        {tool.name}
                      </span>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </div>

      {/* Auth Error Banner */}
      {authError && (
        <div className="mx-6 mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{authError}</p>
        </div>
      )}

      {/* Not Configured Banner */}
      {!isConfigured && !isAuthLoading && (
        <div className="mx-6 mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-warning" />
          <p className="text-sm">CData credentials not configured. Set VITE_CDATA_* environment variables.</p>
        </div>
      )}

      {/* LLM Not Configured Banner */}
      {!isLLMConfigured && (
        <div className="mx-6 mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-warning" />
          <p className="text-sm">Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY environment variable.</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[70%] rounded-2xl px-4 py-3",
                message.role === "user"
                  ? "gradient-primary text-primary-foreground"
                  : "bg-card border border-border"
              )}
            >
              {message.role === "user" ? (
                <div className="flex items-start gap-2">
                  <p className="text-sm whitespace-pre-wrap flex-1">{message.content}</p>
                  <button
                    onClick={() => savePrompt(message.content)}
                    className={cn(
                      "shrink-0 p-1 rounded transition-colors",
                      isPromptSaved(message.content)
                        ? "text-primary-foreground/70 cursor-default"
                        : "text-primary-foreground/50 hover:text-primary-foreground"
                    )}
                    title={isPromptSaved(message.content) ? "Prompt saved" : "Save prompt"}
                    disabled={isPromptSaved(message.content)}
                  >
                    <Bookmark className={cn(
                      "h-4 w-4",
                      isPromptSaved(message.content) && "fill-current"
                    )} />
                  </button>
                </div>
              ) : (
                <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-pre:my-2 prose-code:px-1 prose-code:py-0.5 prose-code:bg-muted prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              )}

              {/* Show tool calls if any */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    Tools used:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {message.toolCalls.map((tc, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded"
                      >
                        {tc.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Processing details for assistant messages */}
              {message.role === "assistant" && (message.processingSteps || message.debugLogs || message.extractedQueries) && (
                <MessageProcessingDetails
                  processingSteps={message.processingSteps}
                  debugLogs={message.debugLogs}
                  extractedQueries={message.extractedQueries}
                  messageId={message.id}
                  onDownloadLogs={handleDownloadLogs}
                  onSaveQuery={(sql) => saveQuery(sql, undefined, "advisor")}
                  isQuerySaved={isQuerySaved}
                />
              )}

              <p className={cn(
                "text-xs mt-2",
                message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
              )}>
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3 min-w-[200px]">
              {thinkingSteps.length === 0 ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Brain className="h-4 w-4 text-primary" />
                    <span>Processing...</span>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {thinkingSteps.map((step) => (
                      <div key={step.id} className="flex items-center gap-2 text-xs">
                        {step.type === "thinking" ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            <span className="text-muted-foreground italic">{step.content}</span>
                          </>
                        ) : (
                          <>
                            {step.status === "pending" ? (
                              <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            ) : step.status === "complete" ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            ) : (
                              <XCircle className="h-3 w-3 text-destructive" />
                            )}
                            <span className={cn(
                              step.status === "pending" ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {step.status === "pending" ? "Calling" : "Called"} {step.toolName}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />

        {/* Suggested Queries (show only when no user messages) */}
        {messages.length === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuery(query.text)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card hover:bg-muted transition-colors text-sm"
                >
                  <query.icon className="h-4 w-4 text-primary" />
                  <span>{query.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-border bg-card">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask a question about your data..."
            className="flex-1 px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !isReady}
            className="h-12 w-12 rounded-xl gradient-primary shadow-glow hover:opacity-90 transition-opacity p-0"
          >
            <Send className="h-5 w-5 text-primary-foreground" />
          </Button>
        </div>
      </div>
      </div>

      {/* Saved Prompts Panel */}
      <SavedPromptsPanel
        onRunPrompt={handleRunSavedPrompt}
        isOpen={savedPromptsOpen}
        onToggle={() => setSavedPromptsOpen(!savedPromptsOpen)}
      />
    </div>
  );
}
