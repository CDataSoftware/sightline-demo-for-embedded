import { useRef, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Loader2, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartCard } from "./ChartCard";
import { useDataSources } from "@/contexts/DataSourcesContext";
import { useDashboardData } from "@/contexts/DashboardDataContext";

function getRatingColor(rating: string): string {
  if (rating === "Hot") return "bg-emerald-500/20 text-emerald-400";
  if (rating === "Warm") return "bg-amber-500/20 text-amber-400";
  return "bg-red-500/20 text-red-400";
}

function getPriorityColor(priority: string): string {
  if (priority === "High") return "bg-emerald-500/20 text-emerald-400";
  if (priority === "Medium") return "bg-amber-500/20 text-amber-400";
  return "bg-red-500/20 text-red-400";
}

function getActiveIcon(active: string) {
  if (active === "Yes") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (active === "No") return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function formatRevenue(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export function CustomerHealthTable() {
  const { zendeskConnection } = useDataSources();

  const {
    customerHealth: data,
    customerHealthLoading: isLoading,
    customerHealthLoadingMore: isLoadingMore,
    customerHealthHasMore: hasMore,
    customerHealthError: error,
    loadMoreCustomerHealth: loadMore,
  } = useDashboardData();

  const scrollRef = useRef<HTMLDivElement>(null);
  const showTicketColumns = !!zendeskConnection;

  // Build query names based on what data sources are connected
  const queryNames = useMemo(() => {
    const names = ["Customer Accounts"];
    if (zendeskConnection) names.push("Tickets by Account");
    return names;
  }, [zendeskConnection]);

  // Infinite scroll handler
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      // Load more when user scrolls to bottom (with 50px threshold)
      if (scrollHeight - scrollTop - clientHeight < 50 && hasMore && !isLoadingMore) {
        loadMore();
      }
    };

    scrollEl.addEventListener("scroll", handleScroll);
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoadingMore, loadMore]);

  // Show loading state only on initial load (no data yet), otherwise show refreshing indicator
  const isInitialLoad = isLoading && data.length === 0;
  const isRefreshing = isLoading && data.length > 0;

  return (
    <ChartCard
      title="Customer Accounts"
      subtitle={isInitialLoad ? "Loading..." : `${data.length} accounts${hasMore ? " • Scroll for more" : ""}`}
      queryNames={queryNames}
      className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col"
      isRefreshing={isRefreshing}
    >
      <div ref={scrollRef} className="overflow-auto max-h-[300px] -mx-6 -mb-6 px-6 pb-6">
        {isInitialLoad ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading customer data...</span>
          </div>
        ) : error ? (
          <div className="p-8">
            <p className="text-destructive text-center">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-8">
            <p className="text-muted-foreground text-center">No customer data available</p>
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card">Account</TableHead>
              <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card">Industry</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right sticky top-0 bg-card">Annual Revenue</TableHead>
              <TableHead className="text-muted-foreground font-medium text-center sticky top-0 bg-card">Rating</TableHead>
              <TableHead className="text-muted-foreground font-medium text-center sticky top-0 bg-card">Priority</TableHead>
              {showTicketColumns && (
                <TableHead className="text-muted-foreground font-medium text-center sticky top-0 bg-card">Open Tickets</TableHead>
              )}
              <TableHead className="text-muted-foreground font-medium text-center sticky top-0 bg-card">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((customer) => (
              <TableRow key={customer.id} className="border-border/50 hover:bg-muted/30">
                <TableCell className="font-medium text-foreground">{customer.account}</TableCell>
                <TableCell className="text-muted-foreground">{customer.industry}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatRevenue(customer.annualRevenue)}
                </TableCell>
                <TableCell className="text-center">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-sm font-medium ${getRatingColor(customer.rating)}`}>
                    {customer.rating}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-sm font-medium ${getPriorityColor(customer.customerPriority)}`}>
                    {customer.customerPriority}
                  </span>
                </TableCell>
                {showTicketColumns && (
                  <TableCell className="text-center">
                    {customer.openTickets !== undefined ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className={customer.urgentTickets ? "text-amber-400 font-medium" : "text-muted-foreground"}>
                          {customer.openTickets}
                        </span>
                        {customer.urgentTickets !== undefined && customer.urgentTickets > 0 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    {getActiveIcon(customer.active)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {isLoadingMore && (
              <TableRow>
                <TableCell colSpan={6 + (showTicketColumns ? 1 : 0)} className="text-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary inline-block mr-2" />
                  <span className="text-muted-foreground text-sm">Loading more...</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        )}
      </div>
    </ChartCard>
  );
}
