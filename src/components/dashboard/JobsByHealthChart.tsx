import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { ChartCard } from "./ChartCard";
import { useDashboardData } from "@/contexts/DashboardDataContext";

export function JobsByHealthChart() {
  const {
    jobsByHealth: rawData,
    jobsByHealthLoading: isLoading,
    jobsByHealthError: error,
  } = useDashboardData();

  // Scale down the data by 100 for more realistic numbers
  const data = rawData.map(d => ({
    ...d,
    healthy: Math.round(d.healthy / 100),
    warning: Math.round(d.warning / 100),
    critical: Math.round(d.critical / 100),
  }));

  const totalJobs = data.reduce(
    (sum, d) => sum + d.healthy + d.warning + d.critical,
    0
  );

  // Show loading state only on initial load (no data yet), otherwise show refreshing indicator
  const isInitialLoad = isLoading && rawData.length === 0;
  const isRefreshing = isLoading && rawData.length > 0;

  return (
    <ChartCard
      title="Customer Interactions by Health Status"
      subtitle={isInitialLoad ? "Loading..." : `${totalJobs.toLocaleString()} total interactions across ${data.length} days`}
      queryNames={["Jobs by Health"]}
      isRefreshing={isRefreshing}
    >
      {isInitialLoad ? (
        <div className="h-[280px] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading interaction data...</span>
        </div>
      ) : error ? (
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-destructive text-center">{error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center">
          <p className="text-muted-foreground text-center">No interaction data available</p>
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "16px" }}
            formatter={(value) => (
              <span style={{ color: "hsl(var(--foreground))", fontSize: 12 }}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="healthy"
            stroke="hsl(var(--success))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--success))", strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="warning"
            stroke="hsl(var(--warning))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--warning))", strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="critical"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--destructive))", strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
