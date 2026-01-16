import { useState, useEffect, useCallback, useRef } from "react";
import { useCData } from "@/contexts/CDataContext";

// Types for dashboard data
export interface CustomerHealthData {
  id: string;
  account: string;
  industry: string;
  annualRevenue: number;
  rating: string;
  customerPriority: string;
  active: string;
  // Cross-system data (optional - only present when Zendesk/Snowflake connected)
  openTickets?: number;
  urgentTickets?: number;
  totalJobRuns?: number;
  lastProductActivity?: string;
}

export interface ContractData {
  id: string;
  account: string;
  amount: number;
  closeDate: string;
  stageName: string;
  probability: number;
}

export interface TicketPriorityData {
  priority: string;
  count: number;
}

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

// Extended account with cross-system data
interface SalesforceAccountWithTickets extends SalesforceAccount {
  OpenTickets?: number;
  UrgentTickets?: number;
}

interface TicketCountByAccount {
  AccountId: string;
  OpenTickets: number;
  UrgentTickets: number;
}

interface UsageByAccount {
  ACCOUNT_ID: string;
  TotalJobRuns: number;
  LastActivity: string;
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

interface UseCustomerHealthDataOptions {
  includeTickets?: boolean;
  includeUsage?: boolean;
}

export function useCustomerHealthData(options: UseCustomerHealthDataOptions = {}) {
  const { includeTickets = false, includeUsage = false } = options;
  const { queryDataAsObjects, isLoading: isAuthLoading, isConfigured, token } = useCData();
  const [data, setData] = useState<CustomerHealthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const hasFetchedRef = useRef(false);
  const optionsRef = useRef({ includeTickets, includeUsage });

  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = { includeTickets, includeUsage };
  }, [includeTickets, includeUsage]);

  const fetchData = useCallback(async (loadMore = false) => {
    if (!isConfigured || !token) return;

    try {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        offsetRef.current = 0;
      }
      setError(null);

      const offset = loadMore ? offsetRef.current : 0;

      // Fetch Salesforce accounts
      const rows = await queryDataAsObjects<SalesforceAccount>(
        `SELECT [Id], [Name], [Industry], [AnnualRevenue], [Rating], [CustomerPriority__c], [Active__c]
         FROM [Salesforce1].[Salesforce].[Account]
         WHERE [Active__c] = 'Yes'
         LIMIT ${PAGE_SIZE} OFFSET ${offset}`
      );

      // Build map of account IDs for cross-system lookups
      const accountIds = rows.map(r => r.Id);

      // Fetch ticket counts if enabled
      let ticketsByAccount: Record<string, { open: number; urgent: number }> = {};
      if (optionsRef.current.includeTickets && accountIds.length > 0) {
        try {
          const ticketRows = await queryDataAsObjects<{ AccountId: string; Priority: string; TicketCount: number }>(
            `SELECT [AccountId], [Priority], COUNT(*) as TicketCount
             FROM [Zendesk1].[Zendesk].[Tickets]
             WHERE [Status] NOT IN ('solved', 'closed')
             GROUP BY [AccountId], [Priority]`
          );

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

      // Fetch usage data if enabled
      let usageByAccount: Record<string, { totalJobs: number; lastActivity: string }> = {};
      if (optionsRef.current.includeUsage && accountIds.length > 0) {
        try {
          const usageRows = await queryDataAsObjects<{ ACCOUNT_ID: string; TotalJobs: number; LastActivity: string }>(
            `SELECT [ACCOUNT_ID], SUM([S_STANDARDJOBRUNS]) as TotalJobs, MAX([LASTTELEMETRYEVENT]) as LastActivity
             FROM [Snowflake1].[TELEMETRY].[SYNC_USAGE]
             GROUP BY [ACCOUNT_ID]`
          );

          for (const row of usageRows) {
            if (!row.ACCOUNT_ID) continue;
            usageByAccount[row.ACCOUNT_ID] = {
              totalJobs: row.TotalJobs || 0,
              lastActivity: row.LastActivity || "",
            };
          }
        } catch (usageErr) {
          console.warn("Failed to fetch usage data:", usageErr);
        }
      }

      // Merge all data
      const newData: CustomerHealthData[] = rows.map((row) => {
        const tickets = ticketsByAccount[row.Id];
        const usage = usageByAccount[row.Id];

        return {
          id: row.Id,
          account: row.Name,
          industry: row.Industry || "Unknown",
          annualRevenue: row.AnnualRevenue || 0,
          rating: row.Rating || "Unknown",
          customerPriority: row.CustomerPriority__c || "Medium",
          active: row.Active__c || "No",
          // Cross-system data
          openTickets: tickets?.open,
          urgentTickets: tickets?.urgent,
          totalJobRuns: usage?.totalJobs,
          lastProductActivity: usage?.lastActivity,
        };
      });

      if (loadMore) {
        setData((prev) => [...prev, ...newData]);
      } else {
        setData(newData);
      }

      offsetRef.current = offset + rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch customer data");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [queryDataAsObjects, isConfigured, token]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchData(true);
    }
  }, [fetchData, isLoadingMore, hasMore]);

  // Initial fetch when token becomes available
  useEffect(() => {
    if (token && isConfigured && !isAuthLoading && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData(false);
    }
  }, [token, isConfigured, isAuthLoading, fetchData]);

  // Refetch when options change
  useEffect(() => {
    if (token && isConfigured && !isAuthLoading && hasFetchedRef.current) {
      fetchData(false);
    }
  }, [includeTickets, includeUsage]);

  return {
    data,
    isLoading: isLoading || isAuthLoading,
    isLoadingMore,
    hasMore,
    error,
    refetch: () => {
      hasFetchedRef.current = false;
      fetchData(false);
    },
    loadMore
  };
}

export function useContractsData() {
  const { queryDataAsObjects, isLoading: isAuthLoading, isConfigured, token } = useCData();
  const [data, setData] = useState<ContractData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async (loadMore = false) => {
    if (!isConfigured || !token) return;

    try {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        offsetRef.current = 0;
      }
      setError(null);

      const offset = loadMore ? offsetRef.current : 0;
      const rows = await queryDataAsObjects<SalesforceOpportunity>(
        `SELECT o.[Id], o.[Name], o.[Amount], o.[CloseDate], o.[StageName], o.[Probability], a.[Name] as AccountName
         FROM [Salesforce1].[Salesforce].[Opportunity] o
         LEFT JOIN [Salesforce1].[Salesforce].[Account] a ON o.[AccountId] = a.[Id]
         WHERE o.[IsClosed] = 0
         ORDER BY o.[CloseDate] ASC
         LIMIT ${PAGE_SIZE} OFFSET ${offset}`
      );

      const newData = rows.map((row) => ({
        id: row.Id,
        account: row.AccountName || row.Name,
        amount: row.Amount || 0,
        closeDate: row.CloseDate,
        stageName: row.StageName,
        probability: row.Probability || 0,
      }));

      if (loadMore) {
        setData((prev) => [...prev, ...newData]);
      } else {
        setData(newData);
      }

      offsetRef.current = offset + rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch contracts data");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [queryDataAsObjects, isConfigured, token]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchData(true);
    }
  }, [fetchData, isLoadingMore, hasMore]);

  // Initial fetch when token becomes available
  useEffect(() => {
    if (token && isConfigured && !isAuthLoading && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData(false);
    }
  }, [token, isConfigured, isAuthLoading, fetchData]);

  return {
    data,
    isLoading: isLoading || isAuthLoading,
    isLoadingMore,
    hasMore,
    error,
    refetch: () => {
      hasFetchedRef.current = false;
      fetchData(false);
    },
    loadMore
  };
}

export function useTicketsByPriority() {
  const { queryDataAsObjects, isLoading: isAuthLoading, isConfigured, token } = useCData();
  const [data, setData] = useState<TicketPriorityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!isConfigured || !token) return;

    try {
      setIsLoading(true);
      setError(null);

      const rows = await queryDataAsObjects<ZendeskTicketCount>(
        `SELECT [Priority], COUNT(*) as count
         FROM [Zendesk1].[Zendesk].[Tickets]
         GROUP BY [Priority]`
      );

      setData(
        rows.map((row) => ({
          priority: row.Priority || "unknown",
          count: row.count || 0,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch ticket data");
    } finally {
      setIsLoading(false);
    }
  }, [queryDataAsObjects, isConfigured, token]);

  // Initial fetch when token becomes available
  useEffect(() => {
    if (token && isConfigured && !isAuthLoading && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [token, isConfigured, isAuthLoading, fetchData]);

  return {
    data,
    isLoading: isLoading || isAuthLoading,
    error,
    refetch: () => {
      hasFetchedRef.current = false;
      fetchData();
    }
  };
}

// Types for Snowflake SYNC_USAGE data
export interface JobsByHealthData {
  date: string;
  healthy: number;
  warning: number;
  critical: number;
}

interface SyncUsageRow {
  LASTTELEMETRYEVENT: string;
  S_STANDARDJOBRUNS: number;
  REVENUEBUCKETLAST12M: string;
}

// Categorize revenue buckets into health status
function getHealthCategory(revenueBucket: string): "healthy" | "warning" | "critical" {
  // High revenue = healthy, medium = warning, low = critical
  if (revenueBucket.includes("100k") || revenueBucket.includes("250k") || revenueBucket.includes("500k") || revenueBucket.includes("1M")) {
    return "healthy";
  }
  if (revenueBucket.includes("50k") || revenueBucket.includes("25k")) {
    return "warning";
  }
  return "critical";
}

export function useJobsByHealth() {
  const { queryDataAsObjects, isLoading: isAuthLoading, isConfigured, token } = useCData();
  const [data, setData] = useState<JobsByHealthData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!isConfigured || !token) return;

    try {
      setIsLoading(true);
      setError(null);

      // Query job runs grouped by date and revenue bucket
      // Use a larger limit to capture multiple days of data across many accounts
      const rows = await queryDataAsObjects<SyncUsageRow>(
        `SELECT [LASTTELEMETRYEVENT], [S_STANDARDJOBRUNS], [REVENUEBUCKETLAST12M]
         FROM [Snowflake1].[TELEMETRY].[SYNC_USAGE]
         WHERE [LASTTELEMETRYEVENT] IS NOT NULL
         ORDER BY [LASTTELEMETRYEVENT] DESC
         LIMIT 5000`
      );

      // Aggregate by date and health category
      const aggregated: Record<string, { healthy: number; warning: number; critical: number; timestamp: number }> = {};

      for (const row of rows) {
        if (!row.LASTTELEMETRYEVENT) continue;

        // Extract date part (e.g., "Dec 1")
        const dateObj = new Date(row.LASTTELEMETRYEVENT);
        const dateKey = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        // Store timestamp for proper sorting
        const timestamp = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();

        if (!aggregated[dateKey]) {
          aggregated[dateKey] = { healthy: 0, warning: 0, critical: 0, timestamp };
        }

        const category = getHealthCategory(row.REVENUEBUCKETLAST12M || "");
        aggregated[dateKey][category] += row.S_STANDARDJOBRUNS || 0;
      }

      // Convert to array and sort by timestamp (most recent first), then take last 14 days
      const chartData = Object.entries(aggregated)
        .map(([date, values]) => ({
          date,
          healthy: values.healthy,
          warning: values.warning,
          critical: values.critical,
          timestamp: values.timestamp,
        }))
        .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp descending
        .slice(0, 14) // Last 14 days
        .reverse() // Oldest first for chart display
        .map(({ date, healthy, warning, critical }) => ({ date, healthy, warning, critical }));

      setData(chartData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch job health data");
    } finally {
      setIsLoading(false);
    }
  }, [queryDataAsObjects, isConfigured, token]);

  // Initial fetch when token becomes available
  useEffect(() => {
    if (token && isConfigured && !isAuthLoading && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [token, isConfigured, isAuthLoading, fetchData]);

  return {
    data,
    isLoading: isLoading || isAuthLoading,
    error,
    refetch: () => {
      hasFetchedRef.current = false;
      fetchData();
    }
  };
}
