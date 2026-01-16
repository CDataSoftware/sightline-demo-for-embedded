import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerHealthTable } from "@/components/dashboard/CustomerHealthTable";
import { ContractsEndingTable } from "@/components/dashboard/ContractsEndingTable";
import { TicketsByPriorityChart } from "@/components/dashboard/TicketsByPriorityChart";
import { DataSourcesPopover } from "@/components/dashboard/DataSourcesPopover";
import { AccountInsightsChart } from "@/components/dashboard/AccountInsightsChart";
import { useDashboardData } from "@/contexts/DashboardDataContext";

export default function Dashboard() {
  const { refreshAll, isRefreshing } = useDashboardData();

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Health</h1>
          <p className="text-muted-foreground mt-1">Monitor account health and renewal status at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <DataSourcesPopover />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <CustomerHealthTable />
          <AccountInsightsChart />
        </div>
        <div className="flex flex-col gap-6">
          <ContractsEndingTable />
          <TicketsByPriorityChart />
        </div>
      </div>
    </div>
  );
}
