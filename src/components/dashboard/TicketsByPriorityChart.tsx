import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ChartCard } from "./ChartCard";
import { useDashboardData } from "@/contexts/DashboardDataContext";

const COLORS: Record<string, string> = {
  urgent: "hsl(0, 84%, 60%)",    // Red
  high: "hsl(25, 95%, 53%)",     // Orange
  normal: "hsl(45, 93%, 47%)",   // Yellow/Amber
  low: "hsl(142, 71%, 45%)",     // Green
  unknown: "hsl(215, 20%, 65%)", // Gray
};

export function TicketsByPriorityChart() {
  const {
    ticketsByPriority: data,
    ticketsByPriorityLoading: isLoading,
    ticketsByPriorityError: error,
  } = useDashboardData();

  const chartData = data.map((item) => ({
    name: item.priority.charAt(0).toUpperCase() + item.priority.slice(1),
    value: item.count,
    color: COLORS[item.priority] || COLORS.unknown,
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  // Show loading state only on initial load (no data yet), otherwise show refreshing indicator
  const isInitialLoad = isLoading && data.length === 0;
  const isRefreshing = isLoading && data.length > 0;

  return (
    <ChartCard
      title="Tickets by Priority"
      subtitle={isInitialLoad ? "Loading..." : `${total} total tickets`}
      queryNames={["Tickets by Priority"]}
      className="border-border/50 bg-card/50 backdrop-blur-sm"
      isRefreshing={isRefreshing}
    >
      <div className="h-[180px]">
        {isInitialLoad ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading ticket data...</span>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-destructive text-center">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground text-center">No ticket data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
                formatter={(value: number, name: string) => [
                  `${value} tickets (${((value / total) * 100).toFixed(1)}%)`,
                  name,
                ]}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                formatter={(value) => (
                  <span className="text-muted-foreground text-sm">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}
