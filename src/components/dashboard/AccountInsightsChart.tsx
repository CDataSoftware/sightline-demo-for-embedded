import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Loader2, Snowflake } from "lucide-react";
import { ChartCard } from "./ChartCard";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { useDataSources } from "@/contexts/DataSourcesContext";

interface AccountBubble {
  id: string;
  name: string;
  revenue: number;
  engagement: number;
  tickets: number;
  rating: string;
  health: "healthy" | "warning" | "critical";
}

interface RatingAggregate {
  rating: string;
  totalRevenue: number;
  accountCount: number;
  avgRevenue: number;
}

function getHealthColor(health: string): string {
  switch (health) {
    case "healthy":
      return "hsl(var(--success))";
    case "warning":
      return "hsl(var(--warning))";
    case "critical":
      return "hsl(var(--destructive))";
    default:
      return "hsl(var(--muted-foreground))";
  }
}

function getRatingColor(rating: string): string {
  switch (rating) {
    case "Hot":
      return "hsl(var(--success))";
    case "Warm":
      return "hsl(var(--warning))";
    case "Cold":
      return "hsl(var(--destructive))";
    default:
      return "hsl(var(--muted-foreground))";
  }
}

function formatRevenue(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatEngagement(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function determineHealth(
  engagement: number | undefined,
  tickets: number | undefined,
  rating: string
): "healthy" | "warning" | "critical" {
  // If we have engagement data, use it primarily
  if (engagement !== undefined) {
    if (engagement > 1000) return "healthy";
    if (engagement > 100) return "warning";
    return "critical";
  }
  // Fall back to rating
  if (rating === "Hot") return "healthy";
  if (rating === "Warm") return "warning";
  return "critical";
}

// Custom tooltip for bubble chart
function BubbleTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: AccountBubble }> }) {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-foreground mb-2">{data.name}</p>
      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">
          Revenue: <span className="text-foreground">{formatRevenue(data.revenue)}</span>
        </p>
        <p className="text-muted-foreground">
          Engagement: <span className="text-foreground">{formatEngagement(data.engagement)} interactions</span>
        </p>
        {data.tickets > 0 && (
          <p className="text-muted-foreground">
            Open Tickets: <span className="text-warning">{data.tickets}</span>
          </p>
        )}
        <p className="text-muted-foreground">
          Health: <span style={{ color: getHealthColor(data.health) }} className="capitalize">{data.health}</span>
        </p>
      </div>
    </div>
  );
}

// Custom tooltip for bar chart
function BarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RatingAggregate }> }) {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-foreground mb-2">{data.rating} Accounts</p>
      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">
          Total Revenue: <span className="text-foreground">{formatRevenue(data.totalRevenue)}</span>
        </p>
        <p className="text-muted-foreground">
          Accounts: <span className="text-foreground">{data.accountCount}</span>
        </p>
        <p className="text-muted-foreground">
          Avg Revenue: <span className="text-foreground">{formatRevenue(data.avgRevenue)}</span>
        </p>
      </div>
    </div>
  );
}

export function AccountInsightsChart() {
  const { snowflakeConnection, zendeskConnection } = useDataSources();
  const {
    customerHealth: data,
    customerHealthLoading: isLoading,
    customerHealthError: error,
  } = useDashboardData();

  const hasSnowflake = !!snowflakeConnection;
  const hasZendesk = !!zendeskConnection;

  // Transform data for bubble chart (with Snowflake)
  const bubbleData: AccountBubble[] = data
    .filter((d) => d.annualRevenue > 0)
    .map((d) => ({
      id: d.id,
      name: d.account,
      revenue: d.annualRevenue,
      engagement: d.totalJobRuns ? Math.round(d.totalJobRuns / 100) : Math.random() * 500, // Scale down and fallback for demo
      tickets: d.openTickets || 0,
      rating: d.rating,
      health: determineHealth(d.totalJobRuns, d.openTickets, d.rating),
    }))
    .slice(0, 50); // Limit for performance

  // Transform data for bar chart (without Snowflake)
  const ratingData: RatingAggregate[] = ["Hot", "Warm", "Cold"].map((rating) => {
    const accounts = data.filter((d) => d.rating === rating);
    const totalRevenue = accounts.reduce((sum, d) => sum + (d.annualRevenue || 0), 0);
    return {
      rating,
      totalRevenue,
      accountCount: accounts.length,
      avgRevenue: accounts.length > 0 ? totalRevenue / accounts.length : 0,
    };
  }).filter((d) => d.accountCount > 0);

  const totalRevenue = data.reduce((sum, d) => sum + (d.annualRevenue || 0), 0);
  const accountCount = data.length;

  // Determine chart title and subtitle based on available data
  const title = hasSnowflake ? "Engagement vs Revenue" : "Revenue by Account Rating";
  const subtitle = hasSnowflake
    ? `${accountCount} accounts | Bubble size = ticket volume`
    : `${formatRevenue(totalRevenue)} across ${accountCount} accounts`;

  // Build query names based on what data sources are connected
  const queryNames = ["Customer Accounts"];
  if (hasZendesk) queryNames.push("Tickets by Account");
  if (hasSnowflake) queryNames.push("Usage by Account");

  // Show loading state only on initial load (no data yet), otherwise show refreshing indicator
  const isInitialLoad = isLoading && data.length === 0;
  const isRefreshing = isLoading && data.length > 0;

  return (
    <ChartCard
      title={title}
      subtitle={isInitialLoad ? "Loading..." : subtitle}
      queryNames={queryNames}
      isRefreshing={isRefreshing}
      action={
        !hasSnowflake && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
            <Snowflake className="h-3 w-3" />
            <span>Connect Snowflake for engagement data</span>
          </div>
        )
      }
    >
      {isInitialLoad ? (
        <div className="h-[280px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading account data...</span>
        </div>
      ) : error ? (
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-destructive text-center">{error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-muted-foreground text-center">No account data available</p>
        </div>
      ) : hasSnowflake ? (
        // Bubble chart when Snowflake is connected
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              type="number"
              dataKey="revenue"
              name="Revenue"
              tickFormatter={(v) => formatRevenue(v)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              label={{
                value: "Annual Revenue",
                position: "bottom",
                offset: 0,
                style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
              }}
            />
            <YAxis
              type="number"
              dataKey="engagement"
              name="Engagement"
              tickFormatter={(v) => formatEngagement(v)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              label={{
                value: "Product Engagement",
                angle: -90,
                position: "insideLeft",
                style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
              }}
            />
            <ZAxis
              type="number"
              dataKey="tickets"
              range={[40, 400]}
              name="Tickets"
            />
            <Tooltip content={<BubbleTooltip />} />
            <Scatter data={bubbleData} shape="circle">
              {bubbleData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getHealthColor(entry.health)}
                  fillOpacity={0.7}
                  stroke={getHealthColor(entry.health)}
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      ) : (
        // Bar chart when Snowflake is not connected
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={ratingData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="rating"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              tickFormatter={(v) => formatRevenue(v)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <Tooltip content={<BarTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "16px" }}
              formatter={() => (
                <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>
                  Total Revenue
                </span>
              )}
            />
            <Bar dataKey="totalRevenue" name="Revenue" radius={[4, 4, 0, 0]}>
              {ratingData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getRatingColor(entry.rating)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
