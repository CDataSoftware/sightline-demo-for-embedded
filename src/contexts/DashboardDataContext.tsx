import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { useCData } from "@/contexts/CDataContext";
import { useDataSources } from "@/contexts/DataSourcesContext";
import type { CustomerHealthData, ContractData, TicketPriorityData, JobsByHealthData } from "@/hooks/useDashboardData";

// Raw types from API
interface SalesforceAccount {
  Id: string;
  Name: string;
  Industry: string;
  AnnualRevenue: number;
  Rating: string;
  CustomerPriority__c: string;
  Active__c: string;
}

interface SalesforceOpportunity {
  Id: string;
  Name: string;
  Amount: number;
  CloseDate: string;
  StageName: string;
  Probability: number;
  AccountName: string;
}

interface ZendeskTicketCount {
  Priority: string;
  count: number;
}

const PAGE_SIZE = 15;

// SQL query tracking
export interface ExecutedQuery {
  id: string;
  name: string;
  sql: string;
  timestamp: Date;
  duration?: number;
  rowCount?: number;
  error?: string;
}

interface DashboardDataState {
  // Customer Health
  customerHealth: CustomerHealthData[];
  customerHealthLoading: boolean;
  customerHealthLoadingMore: boolean;
  customerHealthError: string | null;
  customerHealthHasMore: boolean;
  customerHealthOffset: number;

  // Contracts
  contracts: ContractData[];
  contractsLoading: boolean;
  contractsLoadingMore: boolean;
  contractsError: string | null;
  contractsHasMore: boolean;
  contractsOffset: number;

  // Tickets by Priority
  ticketsByPriority: TicketPriorityData[];
  ticketsByPriorityLoading: boolean;
  ticketsByPriorityError: string | null;

  // Jobs by Health
  jobsByHealth: JobsByHealthData[];
  jobsByHealthLoading: boolean;
  jobsByHealthError: string | null;

  // Executed queries
  executedQueries: ExecutedQuery[];
}

interface DashboardDataContextValue extends DashboardDataState {
  refreshAll: () => void;
  loadMoreCustomerHealth: () => void;
  loadMoreContracts: () => void;
  clearQueries: () => void;
  getQueriesByName: (name: string) => ExecutedQuery[];
  isRefreshing: boolean;
}

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { queryDataAsObjects, isLoading: isAuthLoading, isConfigured, token } = useCData();
  const { snowflakeConnection, zendeskConnection, salesforceConnection } = useDataSources();

  // Get connection names for SQL queries (these are the catalog names in CData)
  const snowflakeConnName = snowflakeConnection?.name;
  const zendeskConnName = zendeskConnection?.name;
  const salesforceConnName = salesforceConnection?.name;

  // Track data source state for comparison - store previous values to detect changes
  const prevDataSourcesRef = useRef<{
    zendeskConnName: string | undefined;
    snowflakeConnName: string | undefined;
    salesforceConnName: string | undefined;
  }>({ zendeskConnName: undefined, snowflakeConnName: undefined, salesforceConnName: undefined });
  const hasFetchedRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // All dashboard state
  const [state, setState] = useState<DashboardDataState>({
    customerHealth: [],
    customerHealthLoading: true,
    customerHealthLoadingMore: false,
    customerHealthError: null,
    customerHealthHasMore: true,
    customerHealthOffset: 0,

    contracts: [],
    contractsLoading: true,
    contractsLoadingMore: false,
    contractsError: null,
    contractsHasMore: true,
    contractsOffset: 0,

    ticketsByPriority: [],
    ticketsByPriorityLoading: true,
    ticketsByPriorityError: null,

    jobsByHealth: [],
    jobsByHealthLoading: true,
    jobsByHealthError: null,

    executedQueries: [],
  });

  // Helper to track executed queries
  const trackQuery = useCallback((name: string, sql: string, startTime: number, rowCount?: number, error?: string) => {
    const query: ExecutedQuery = {
      id: `${name}-${Date.now()}`,
      name,
      sql: sql.trim().replace(/\s+/g, ' '),
      timestamp: new Date(),
      duration: Date.now() - startTime,
      rowCount,
      error,
    };
    setState(prev => ({
      ...prev,
      executedQueries: [...prev.executedQueries, query],
    }));
  }, []);

  // Clear executed queries (called on refresh)
  const clearQueries = useCallback(() => {
    setState(prev => ({ ...prev, executedQueries: [] }));
  }, []);

  // Get queries by name (for per-chart SQL viewing)
  const getQueriesByName = useCallback((name: string): ExecutedQuery[] => {
    return state.executedQueries.filter(q => q.name === name);
  }, [state.executedQueries]);

  // Fetch customer health data (Salesforce + Zendesk only, no Snowflake)
  const fetchCustomerHealth = useCallback(async (
    loadMore = false,
    zendeskCatalog: string | undefined,
    salesforceCatalog: string | undefined
  ) => {
    if (!isConfigured || !token || !salesforceCatalog) return;

    const offset = loadMore ? state.customerHealthOffset : 0;

    setState(prev => ({
      ...prev,
      customerHealthLoading: !loadMore,
      customerHealthLoadingMore: loadMore,
      customerHealthError: null,
    }));

    try {
      const accountSql = `SELECT [Id], [Name], [Industry], [AnnualRevenue], [Rating], [CustomerPriority__c], [Active__c]
         FROM [${salesforceCatalog}].[Salesforce].[Account]
         WHERE [Active__c] = 'Yes'
         LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
      const accountStart = Date.now();
      const rows = await queryDataAsObjects<SalesforceAccount>(accountSql);
      trackQuery("Customer Accounts", accountSql, accountStart, rows.length);

      // Fetch ticket counts if Zendesk is connected
      let ticketsByAccount: Record<string, { open: number; urgent: number }> = {};
      if (zendeskCatalog && rows.length > 0) {
        try {
          const ticketSql = `SELECT [AccountId], [Priority], COUNT(*) as TicketCount
             FROM [${zendeskCatalog}].[Zendesk].[Tickets]
             WHERE [Status] NOT IN ('solved', 'closed')
             GROUP BY [AccountId], [Priority]`;
          const ticketStart = Date.now();
          const ticketRows = await queryDataAsObjects<{ AccountId: string; Priority: string; TicketCount: number }>(ticketSql);
          trackQuery("Tickets by Account", ticketSql, ticketStart, ticketRows.length);

          for (const row of ticketRows) {
            if (!row.AccountId) continue;
            if (!ticketsByAccount[row.AccountId]) {
              ticketsByAccount[row.AccountId] = { open: 0, urgent: 0 };
            }
            ticketsByAccount[row.AccountId].open += row.TicketCount || 0;
            if (row.Priority === 'urgent' || row.Priority === 'high') {
              ticketsByAccount[row.AccountId].urgent += row.TicketCount || 0;
            }
          }
        } catch (ticketErr) {
          console.warn("Failed to fetch ticket data:", ticketErr);
        }
      }

      const newData: CustomerHealthData[] = rows.map((row) => {
        const tickets = ticketsByAccount[row.Id];

        return {
          id: row.Id,
          account: row.Name,
          industry: row.Industry || "Unknown",
          annualRevenue: row.AnnualRevenue || 0,
          rating: row.Rating || "Unknown",
          customerPriority: row.CustomerPriority__c || "Medium",
          active: row.Active__c || "No",
          openTickets: tickets?.open,
          urgentTickets: tickets?.urgent,
        };
      });

      setState(prev => ({
        ...prev,
        customerHealth: loadMore ? [...prev.customerHealth, ...newData] : newData,
        customerHealthLoading: false,
        customerHealthLoadingMore: false,
        customerHealthHasMore: rows.length === PAGE_SIZE,
        customerHealthOffset: offset + rows.length,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        customerHealthLoading: false,
        customerHealthLoadingMore: false,
        customerHealthError: err instanceof Error ? err.message : "Failed to fetch customer data",
      }));
    }
  }, [queryDataAsObjects, isConfigured, token, state.customerHealthOffset, trackQuery]);

  // Fetch contracts data
  const fetchContracts = useCallback(async (loadMore = false, salesforceCatalog: string | undefined) => {
    if (!isConfigured || !token || !salesforceCatalog) return;

    const offset = loadMore ? state.contractsOffset : 0;

    setState(prev => ({
      ...prev,
      contractsLoading: !loadMore,
      contractsLoadingMore: loadMore,
      contractsError: null,
    }));

    try {
      const contractSql = `SELECT o.[Id], o.[Name], o.[Amount], o.[CloseDate], o.[StageName], o.[Probability], a.[Name] as AccountName
         FROM [${salesforceCatalog}].[Salesforce].[Opportunity] o
         LEFT JOIN [${salesforceCatalog}].[Salesforce].[Account] a ON o.[AccountId] = a.[Id]
         WHERE o.[IsClosed] = 0
         ORDER BY o.[CloseDate] ASC
         LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
      const contractStart = Date.now();
      const rows = await queryDataAsObjects<SalesforceOpportunity>(contractSql);
      trackQuery("Open Opportunities", contractSql, contractStart, rows.length);

      const newData = rows.map((row) => ({
        id: row.Id,
        account: row.AccountName || row.Name,
        amount: row.Amount || 0,
        closeDate: row.CloseDate,
        stageName: row.StageName,
        probability: row.Probability || 0,
      }));

      setState(prev => ({
        ...prev,
        contracts: loadMore ? [...prev.contracts, ...newData] : newData,
        contractsLoading: false,
        contractsLoadingMore: false,
        contractsHasMore: rows.length === PAGE_SIZE,
        contractsOffset: offset + rows.length,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        contractsLoading: false,
        contractsLoadingMore: false,
        contractsError: err instanceof Error ? err.message : "Failed to fetch contracts data",
      }));
    }
  }, [queryDataAsObjects, isConfigured, token, state.contractsOffset, trackQuery]);

  // Fetch tickets by priority
  const fetchTicketsByPriority = useCallback(async (zendeskCatalog: string | undefined) => {
    if (!isConfigured || !token || !zendeskCatalog) return;

    setState(prev => ({ ...prev, ticketsByPriorityLoading: true, ticketsByPriorityError: null }));

    try {
      const ticketPrioritySql = `SELECT [Priority], COUNT(*) as count
         FROM [${zendeskCatalog}].[Zendesk].[Tickets]
         GROUP BY [Priority]`;
      const ticketPriorityStart = Date.now();
      const rows = await queryDataAsObjects<ZendeskTicketCount>(ticketPrioritySql);
      trackQuery("Tickets by Priority", ticketPrioritySql, ticketPriorityStart, rows.length);

      setState(prev => ({
        ...prev,
        ticketsByPriority: rows.map((row) => ({
          priority: row.Priority || "unknown",
          count: row.count || 0,
        })),
        ticketsByPriorityLoading: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        ticketsByPriorityLoading: false,
        ticketsByPriorityError: err instanceof Error ? err.message : "Failed to fetch ticket data",
      }));
    }
  }, [queryDataAsObjects, isConfigured, token, trackQuery]);

  // Fetch jobs by health - aggregation done in SQL for performance
  const fetchJobsByHealth = useCallback(async (snowflakeCatalog: string | undefined) => {
    if (!isConfigured || !token || !snowflakeCatalog) return;

    setState(prev => ({ ...prev, jobsByHealthLoading: true, jobsByHealthError: null }));

    try {
      // Push aggregation to SQL: group by date and health category, sum job runs
      // Health categories based on revenue bucket:
      //   healthy: 100k, 250k, 500k, 1M
      //   warning: 25k, 50k
      //   critical: everything else
      const jobsSql = `SELECT
           CAST([LASTTELEMETRYEVENT] AS DATE) as EventDate,
           SUM(CASE WHEN [REVENUEBUCKETLAST12M] LIKE '%100k%'
                      OR [REVENUEBUCKETLAST12M] LIKE '%250k%'
                      OR [REVENUEBUCKETLAST12M] LIKE '%500k%'
                      OR [REVENUEBUCKETLAST12M] LIKE '%1M%'
                    THEN [S_STANDARDJOBRUNS] ELSE 0 END) as Healthy,
           SUM(CASE WHEN [REVENUEBUCKETLAST12M] LIKE '%50k%'
                      OR [REVENUEBUCKETLAST12M] LIKE '%25k%'
                    THEN [S_STANDARDJOBRUNS] ELSE 0 END) as Warning,
           SUM(CASE WHEN NOT ([REVENUEBUCKETLAST12M] LIKE '%100k%'
                           OR [REVENUEBUCKETLAST12M] LIKE '%250k%'
                           OR [REVENUEBUCKETLAST12M] LIKE '%500k%'
                           OR [REVENUEBUCKETLAST12M] LIKE '%1M%'
                           OR [REVENUEBUCKETLAST12M] LIKE '%50k%'
                           OR [REVENUEBUCKETLAST12M] LIKE '%25k%')
                    THEN [S_STANDARDJOBRUNS] ELSE 0 END) as Critical
         FROM [${snowflakeCatalog}].[TELEMETRY].[SYNC_USAGE]
         WHERE [LASTTELEMETRYEVENT] IS NOT NULL
         GROUP BY CAST([LASTTELEMETRYEVENT] AS DATE)
         ORDER BY EventDate DESC
         LIMIT 14`;
      const jobsStart = Date.now();
      const rows = await queryDataAsObjects<{ EventDate: string; Healthy: number; Warning: number; Critical: number }>(jobsSql);
      trackQuery("Jobs by Health", jobsSql, jobsStart, rows.length);

      // Simple transformation: format dates and reverse for chronological order
      const chartData = rows
        .map((row) => {
          const dateObj = new Date(row.EventDate);
          return {
            date: dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            healthy: row.Healthy || 0,
            warning: row.Warning || 0,
            critical: row.Critical || 0,
          };
        })
        .reverse();

      setState(prev => ({
        ...prev,
        jobsByHealth: chartData,
        jobsByHealthLoading: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        jobsByHealthLoading: false,
        jobsByHealthError: err instanceof Error ? err.message : "Failed to fetch job health data",
      }));
    }
  }, [queryDataAsObjects, isConfigured, token, trackQuery]);

  // Fetch all data
  const fetchAllData = useCallback(async (
    zendeskCatalog: string | undefined,
    snowflakeCatalog: string | undefined,
    salesforceCatalog: string | undefined
  ) => {
    // Only fetch if we have at least Salesforce connected
    if (!salesforceCatalog) return;

    await Promise.all([
      fetchCustomerHealth(false, zendeskCatalog, salesforceCatalog),
      fetchContracts(false, salesforceCatalog),
      zendeskCatalog ? fetchTicketsByPriority(zendeskCatalog) : Promise.resolve(),
      snowflakeCatalog ? fetchJobsByHealth(snowflakeCatalog) : Promise.resolve(),
    ]);
  }, [fetchCustomerHealth, fetchContracts, fetchTicketsByPriority, fetchJobsByHealth]);

  // Manual refresh
  const refreshAll = useCallback(() => {
    setIsRefreshing(true);
    clearQueries();
    // Reset offsets
    setState(prev => ({
      ...prev,
      customerHealthOffset: 0,
      contractsOffset: 0,
    }));
    fetchAllData(zendeskConnName, snowflakeConnName, salesforceConnName).finally(() => {
      setIsRefreshing(false);
    });
  }, [fetchAllData, zendeskConnName, snowflakeConnName, salesforceConnName, clearQueries]);

  // Load more handlers
  const loadMoreCustomerHealth = useCallback(() => {
    if (!state.customerHealthLoadingMore && state.customerHealthHasMore) {
      fetchCustomerHealth(true, zendeskConnName, salesforceConnName);
    }
  }, [fetchCustomerHealth, state.customerHealthLoadingMore, state.customerHealthHasMore, zendeskConnName, salesforceConnName]);

  const loadMoreContracts = useCallback(() => {
    if (!state.contractsLoadingMore && state.contractsHasMore) {
      fetchContracts(true, salesforceConnName);
    }
  }, [fetchContracts, state.contractsLoadingMore, state.contractsHasMore, salesforceConnName]);

  // Initial fetch when token becomes available
  useEffect(() => {
    if (token && isConfigured && !isAuthLoading && !hasFetchedRef.current && salesforceConnName) {
      hasFetchedRef.current = true;
      fetchAllData(zendeskConnName, snowflakeConnName, salesforceConnName);
    }
  }, [token, isConfigured, isAuthLoading, fetchAllData, zendeskConnName, snowflakeConnName, salesforceConnName]);

  // Selectively refetch when data sources change - only refresh affected visualizations
  // Data source dependencies:
  // - Customer Health: Salesforce (primary), Zendesk (tickets)
  // - Contracts: Salesforce only
  // - Tickets by Priority: Zendesk only
  // - Jobs by Health (Engagement vs Revenue): Snowflake only
  useEffect(() => {
    if (!hasFetchedRef.current) return;

    const prev = prevDataSourcesRef.current;
    const salesforceChanged = prev.salesforceConnName !== salesforceConnName;
    const zendeskChanged = prev.zendeskConnName !== zendeskConnName;
    const snowflakeChanged = prev.snowflakeConnName !== snowflakeConnName;

    // Skip if nothing changed
    if (!salesforceChanged && !zendeskChanged && !snowflakeChanged) return;

    // Update ref for next comparison
    prevDataSourcesRef.current = { zendeskConnName, snowflakeConnName, salesforceConnName };

    // If Salesforce changed, we need to refetch customer health and contracts
    if (salesforceChanged) {
      setState(prev => ({
        ...prev,
        customerHealthOffset: 0,
        contractsOffset: 0,
      }));
      // Salesforce is the primary source - refetch both Salesforce-dependent views
      fetchCustomerHealth(false, zendeskConnName, salesforceConnName);
      fetchContracts(false, salesforceConnName);
    } else {
      // Salesforce didn't change, but Zendesk might have (adds ticket columns to customer health)
      // Note: Snowflake no longer affects customer health - only Jobs by Health chart
      if (zendeskChanged) {
        setState(prev => ({
          ...prev,
          customerHealthOffset: 0,
        }));
        fetchCustomerHealth(false, zendeskConnName, salesforceConnName);
      }
    }

    // Zendesk-specific: Tickets by Priority chart
    if (zendeskChanged) {
      if (zendeskConnName) {
        fetchTicketsByPriority(zendeskConnName);
      } else {
        // Zendesk was disabled - clear the data
        setState(prev => ({
          ...prev,
          ticketsByPriority: [],
          ticketsByPriorityLoading: false,
          ticketsByPriorityError: null,
        }));
      }
    }

    // Snowflake-specific: Jobs by Health chart
    if (snowflakeChanged) {
      if (snowflakeConnName) {
        fetchJobsByHealth(snowflakeConnName);
      } else {
        // Snowflake was disabled - clear the data
        setState(prev => ({
          ...prev,
          jobsByHealth: [],
          jobsByHealthLoading: false,
          jobsByHealthError: null,
        }));
      }
    }
  }, [zendeskConnName, snowflakeConnName, salesforceConnName, fetchCustomerHealth, fetchContracts, fetchTicketsByPriority, fetchJobsByHealth]);

  return (
    <DashboardDataContext.Provider
      value={{
        ...state,
        refreshAll,
        loadMoreCustomerHealth,
        loadMoreContracts,
        clearQueries,
        getQueriesByName,
        isRefreshing,
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error("useDashboardData must be used within a DashboardDataProvider");
  }
  return context;
}
