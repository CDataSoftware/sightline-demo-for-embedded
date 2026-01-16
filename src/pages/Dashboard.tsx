import { RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerHealthTable } from "@/components/dashboard/CustomerHealthTable";
import { ContractsEndingTable } from "@/components/dashboard/ContractsEndingTable";
import { TicketsByPriorityChart } from "@/components/dashboard/TicketsByPriorityChart";
import { DataSourcesPopover } from "@/components/dashboard/DataSourcesPopover";
import { AccountInsightsChart } from "@/components/dashboard/AccountInsightsChart";
import { useDashboardData } from "@/contexts/DashboardDataContext";
import { useCData } from "@/contexts/CDataContext";

export default function Dashboard() {
  const { refreshAll, isRefreshing } = useDashboardData();
  const { isConfigured, isLoading: isAuthLoading, error: authError } = useCData();

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Auth Error Banner */}
      {authError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{authError}</p>
        </div>
      )}

      {/* Not Configured Banner */}
      {!isConfigured && !isAuthLoading && (
        <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-warning" />
          <p className="text-sm">CData credentials not configured. Set VITE_CDATA_* environment variables.</p>
        </div>
      )}

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
