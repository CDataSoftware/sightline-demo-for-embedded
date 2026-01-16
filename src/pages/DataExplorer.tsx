import { useState } from "react";
import {
  Database,
  Table,
  Columns,
  ChevronRight,
  ChevronDown,
  Play,
  Loader2,
  RefreshCw,
  FolderOpen,
  Folder,
  Bookmark,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCData } from "@/contexts/CDataContext";
import { useSavedQueries } from "@/contexts/SavedQueriesContext";
import { useSchema, type SchemaItem } from "@/contexts/SchemaContext";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTime: number;
}

export default function DataExplorer() {
  const { queryData, isConfigured, isLoading: isAuthLoading, token } = useCData();
  const { queries: savedQueries, deleteQuery } = useSavedQueries();
  const { schemaTree, isLoadingSchema, refreshSchema, toggleItem } = useSchema();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [showSavedQueries, setShowSavedQueries] = useState(false);

  // Execute SQL query
  const executeQuery = async () => {
    if (!sqlQuery.trim() || !token) return;

    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    const startTime = performance.now();

    try {
      const result = await queryData(sqlQuery);
      const endTime = performance.now();

      if (result.results?.[0]) {
        const { schema, rows } = result.results[0];
        setQueryResult({
          columns: schema.map((col) => col.columnName),
          rows,
          rowCount: rows.length,
          executionTime: Math.round(endTime - startTime),
        });
      }
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : "Query execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  // Generate SELECT query for table
  const selectFromTable = (catalogName: string, schemaName: string, tableName: string) => {
    const query = `SELECT TOP 100 * FROM [${catalogName}].[${schemaName}].[${tableName}]`;
    setSqlQuery(query);
    setSelectedTable(`${catalogName}.${schemaName}.${tableName}`);
  };

  // Render tree item
  const renderTreeItem = (item: SchemaItem, path: string[], depth: number = 0) => {
    const hasChildren = item.type !== "column";
    const fullPath = [...path, item.name];

    return (
      <div key={item.name}>
        <div
          className={cn(
            "flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-muted/50 text-sm",
            selectedTable === fullPath.join(".") && "bg-primary/10"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleItem(item, fullPath);
            }
          }}
          onDoubleClick={() => {
            if (item.type === "table" && path.length >= 2) {
              selectFromTable(path[0], path[1], item.name);
            }
          }}
        >
          {hasChildren && (
            <span className="w-4 h-4 flex items-center justify-center">
              {item.isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : item.isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          )}
          {!hasChildren && <span className="w-4" />}

          {item.type === "connection" && (
            <Database className="h-4 w-4 text-blue-500" />
          )}
          {item.type === "schema" && (
            item.isExpanded ? (
              <FolderOpen className="h-4 w-4 text-yellow-500" />
            ) : (
              <Folder className="h-4 w-4 text-yellow-500" />
            )
          )}
          {item.type === "table" && (
            <Table className="h-4 w-4 text-green-500" />
          )}
          {item.type === "column" && (
            <Columns className="h-4 w-4 text-gray-500" />
          )}

          <span className="truncate">{item.name}</span>
          {item.dataType && (
            <span className="text-xs text-muted-foreground ml-1">
              ({item.dataType})
            </span>
          )}
        </div>

        {item.isExpanded &&
          item.children?.map((child) =>
            renderTreeItem(child, fullPath, depth + 1)
          )}
      </div>
    );
  };

  if (!isConfigured && !isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">
          CData credentials not configured. Set VITE_CDATA_* environment variables.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Data Explorer</h1>
            <p className="text-sm text-muted-foreground">
              Browse schemas, tables, and run queries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedQueries.length > 0 && (
            <Button
              variant={showSavedQueries ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSavedQueries(!showSavedQueries)}
              className="gap-2"
            >
              <Bookmark className="h-4 w-4" />
              Saved ({savedQueries.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshSchema}
            disabled={isLoadingSchema || !token}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isLoadingSchema && "animate-spin")} />
            Refresh Schema
          </Button>
        </div>
      </div>

      {/* Saved Queries Panel */}
      {showSavedQueries && savedQueries.length > 0 && (
        <div className="border-b border-border bg-muted/20 max-h-[200px] overflow-auto">
          <div className="p-2 border-b border-border bg-muted/30 flex items-center justify-between sticky top-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Saved Queries
            </span>
            <button
              onClick={() => setShowSavedQueries(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Hide
            </button>
          </div>
          <div className="p-2 space-y-1">
            {savedQueries.map((query) => (
              <div
                key={query.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer group"
                onClick={() => {
                  setSqlQuery(query.sql);
                  setShowSavedQueries(false);
                }}
              >
                {query.source === "advisor" ? (
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{query.name}</p>
                  <p className="text-xs text-muted-foreground truncate font-mono">{query.sql}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteQuery(query.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Schema Tree Panel */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <div className="h-full flex flex-col border-r border-border">
            <div className="p-2 border-b border-border bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Object Explorer
              </span>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {isLoadingSchema ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Loading schema...</p>
                </div>
              ) : schemaTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                    <Database className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">No connections enabled</p>
                  <p className="text-xs text-muted-foreground mt-1">Enable data sources in Settings</p>
                </div>
              ) : (
                schemaTree.map((item) => renderTreeItem(item, [], 0))
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Query and Results Panel */}
        <ResizablePanel defaultSize={75}>
          <ResizablePanelGroup direction="vertical">
            {/* Query Editor */}
            <ResizablePanel defaultSize={30} minSize={15}>
              <div className="h-full flex flex-col">
                <div className="p-2 border-b border-border bg-muted/30 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Query Editor
                  </span>
                  <Button
                    size="sm"
                    onClick={executeQuery}
                    disabled={isExecuting || !sqlQuery.trim()}
                    className="gap-2 h-7"
                  >
                    {isExecuting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Execute
                  </Button>
                </div>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="Enter SQL query... (Double-click a table to generate SELECT)"
                  className="flex-1 p-3 font-mono text-sm bg-background resize-none focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      executeQuery();
                    }
                  }}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Results Grid */}
            <ResizablePanel defaultSize={70}>
              <div className="h-full flex flex-col">
                <div className="p-2 border-b border-border bg-muted/30 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Results
                  </span>
                  {queryResult && (
                    <span className="text-xs text-muted-foreground">
                      {queryResult.rowCount} rows in {queryResult.executionTime}ms
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-auto">
                  {queryError ? (
                    <div className="p-4 text-destructive text-sm">
                      <strong>Error:</strong> {queryError}
                    </div>
                  ) : queryResult ? (
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          {queryResult.columns.map((col, i) => (
                            <th
                              key={i}
                              className="text-left p-2 border-b border-border font-medium"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="hover:bg-primary/5 border-b border-border/50 transition-colors"
                          >
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="p-2 truncate max-w-[300px]"
                                title={String(cell ?? "")}
                              >
                                {cell === null ? (
                                  <span className="text-muted-foreground italic">
                                    NULL
                                  </span>
                                ) : (
                                  String(cell)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                        <Play className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">Execute a query to see results</p>
                      <p className="text-xs text-muted-foreground">Ctrl+Enter to run</p>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
