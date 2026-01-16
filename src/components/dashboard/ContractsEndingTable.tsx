import { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartCard } from "./ChartCard";
import { useDashboardData } from "@/contexts/DashboardDataContext";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatAmount(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function getStageColor(stage: string): string {
  if (stage === "Closed Won" || stage === "Negotiation/Review") {
    return "bg-emerald-500/20 text-emerald-400";
  }
  if (stage === "Proposal/Price Quote") {
    return "bg-amber-500/20 text-amber-400";
  }
  return "bg-muted text-muted-foreground";
}

export function ContractsEndingTable() {
  const {
    contracts: data,
    contractsLoading: isLoading,
    contractsLoadingMore: isLoadingMore,
    contractsHasMore: hasMore,
    contractsError: error,
    loadMoreContracts: loadMore,
  } = useDashboardData();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Infinite scroll handler
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
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
      title="Upcoming Opportunities"
      subtitle={isInitialLoad ? "Loading..." : `${data.length} contracts${hasMore ? " • Scroll for more" : ""}`}
      queryNames={["Open Opportunities"]}
      className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col"
      isRefreshing={isRefreshing}
    >
      <div ref={scrollRef} className="overflow-auto max-h-[250px] -mx-6 -mb-6 px-6 pb-6">
        {isInitialLoad ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground text-sm">Loading...</span>
          </div>
        ) : error ? (
          <div className="p-8">
            <p className="text-destructive text-center text-sm">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-8">
            <p className="text-muted-foreground text-center text-sm">No upcoming contracts</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium sticky top-0 bg-card">Account</TableHead>
                <TableHead className="text-muted-foreground font-medium text-right sticky top-0 bg-card">Amount</TableHead>
                <TableHead className="text-muted-foreground font-medium text-center sticky top-0 bg-card">Close Date</TableHead>
                <TableHead className="text-muted-foreground font-medium text-center sticky top-0 bg-card">Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((contract) => (
                <TableRow key={contract.id} className="border-border/50 hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground truncate max-w-[150px]" title={contract.account}>
                    {contract.account}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatAmount(contract.amount)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {formatDate(contract.closeDate)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStageColor(contract.stageName)}`}>
                      {contract.probability}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {isLoadingMore && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
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
