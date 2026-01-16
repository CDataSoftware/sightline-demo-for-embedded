import { ReactNode, useState } from "react";
import { Copy, Check, Clock, Database, BarChart3, Code, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDashboardData, ExecutedQuery } from "@/contexts/DashboardDataContext";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  /** Query names to show in SQL toggle (e.g., ["Tickets by Priority"]) */
  queryNames?: string[];
  /** Show a subtle loading indicator while refreshing (keeps existing content visible) */
  isRefreshing?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatSql(sql: string): string {
  // Basic SQL formatting - add newlines before keywords
  return sql
    .replace(/\s+(FROM|WHERE|GROUP BY|ORDER BY|LIMIT|LEFT JOIN|INNER JOIN|RIGHT JOIN|ON|AND|OR)\s+/gi, '\n$1 ')
    .replace(/,\s+/g, ',\n  ')
    .replace(/SELECT\s+/i, 'SELECT\n  ')
    .trim();
}

function QueryBlock({ query }: { query: ExecutedQuery }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(query.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-xs text-foreground">{query.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {query.rowCount !== undefined && (
            <span>{query.rowCount} rows</span>
          )}
          {query.duration !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(query.duration)}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={copyToClipboard}
          >
            {copied ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>
      <pre className="p-3 text-xs overflow-x-auto max-h-[200px] overflow-y-auto">
        <code className="text-foreground/80 whitespace-pre-wrap">{formatSql(query.sql)}</code>
      </pre>
    </div>
  );
}

type ViewMode = "chart" | "sql";

export function ChartCard({ title, subtitle, children, className, action, queryNames, isRefreshing }: ChartCardProps) {
  const { getQueriesByName } = useDashboardData();
  const [viewMode, setViewMode] = useState<ViewMode>("chart");

  // Get only the most recent query for each name (deduplicate)
  const queries: ExecutedQuery[] = queryNames
    ? queryNames.map(name => {
        const allQueries = getQueriesByName(name);
        // Return only the most recent one (last in array)
        return allQueries.length > 0 ? allQueries[allQueries.length - 1] : null;
      }).filter((q): q is ExecutedQuery => q !== null)
    : [];

  const hasQueries = queries.length > 0;

  return (
    <div className={cn(
      "p-6 rounded-xl border bg-card border-border transition-all duration-300 hover:shadow-lg hover:border-primary/20 animate-fade-in",
      className
    )}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {isRefreshing && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasQueries && (
            <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5">
              <button
                onClick={() => setViewMode("chart")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                  viewMode === "chart"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BarChart3 className="h-3 w-3" />
                Chart
              </button>
              <button
                onClick={() => setViewMode("sql")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                  viewMode === "sql"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code className="h-3 w-3" />
                SQL
              </button>
            </div>
          )}
          {action}
        </div>
      </div>

      {viewMode === "sql" && hasQueries ? (
        <div className="space-y-2">
          {queries.map((query) => (
            <QueryBlock key={query.id} query={query} />
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
