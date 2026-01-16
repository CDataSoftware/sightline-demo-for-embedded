import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useCData } from "@/contexts/CDataContext";

export interface DataSourceState {
  id: string;
  name: string;
  driver?: string; // The data source type (e.g., "Salesforce", "Snowflake")
  enabled: boolean;
  connected: boolean;
  connectionId?: string;
  logoUrl?: string;
}

interface DataSourcesContextValue {
  dataSources: DataSourceState[];
  isLoading: boolean;
  setDataSourceEnabled: (id: string, enabled: boolean) => void;
  addDataSource: (dataSource: DataSourceState) => void;
  removeDataSource: (id: string) => void;
  syncFromConnections: (connections: Array<{ id: string; name: string; driver: string }>) => void;
  // Helper to find enabled connection by driver type
  getEnabledConnectionByDriver: (driver: string) => DataSourceState | undefined;
  // Convenience getters for common drivers
  snowflakeConnection: DataSourceState | undefined;
  zendeskConnection: DataSourceState | undefined;
  salesforceConnection: DataSourceState | undefined;
}

const DataSourcesContext = createContext<DataSourcesContextValue | null>(null);

// CData Azure CDN for driver icons
export const getCDataLogoURL = (driver: string) =>
  `https://cdata-cloudprod.azureedge.net/driver-icons/${driver}.svg`;

export function DataSourcesProvider({ children }: { children: ReactNode }) {
  const { token, isConfigured, isLoading: isAuthLoading, listConnections } = useCData();
  const [dataSources, setDataSources] = useState<DataSourceState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  const setDataSourceEnabled = useCallback((id: string, enabled: boolean) => {
    setDataSources((prev) =>
      prev.map((source) =>
        source.id === id ? { ...source, enabled } : source
      )
    );
  }, []);


  const addDataSource = useCallback((dataSource: DataSourceState) => {
    setDataSources((prev) => {
      // Check if already exists
      if (prev.some((s) => s.id === dataSource.id)) {
        // Update existing
        return prev.map((s) =>
          s.id === dataSource.id ? { ...s, ...dataSource } : s
        );
      }
      // Add new
      return [...prev, dataSource];
    });
  }, []);

  const removeDataSource = useCallback((id: string) => {
    setDataSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Sync data sources from CData connections
  const syncFromConnections = useCallback((connections: Array<{ id: string; name: string; driver: string }>) => {
    setDataSources((prev) => {
      // Build a map of existing enabled states by connection ID
      const enabledStates = new Map<string, boolean>();
      prev.forEach((ds) => {
        if (ds.connectionId) {
          enabledStates.set(ds.connectionId, ds.enabled);
        }
      });

      // Create new data sources from connections - use connection name as display name
      const newDataSources: DataSourceState[] = connections.map((conn) => {
        // Preserve enabled state if we had this connection before, otherwise default to true
        const wasEnabled = enabledStates.get(conn.id);
        const enabled = wasEnabled !== undefined ? wasEnabled : true;

        return {
          id: conn.id, // Use connection ID as the unique identifier
          name: conn.name, // Use connection name for display
          driver: conn.driver, // Store driver for filtering
          enabled,
          connected: true,
          connectionId: conn.id,
          logoUrl: getCDataLogoURL(conn.driver),
        };
      });

      return newDataSources;
    });
    setIsLoading(false);
  }, []);

  // Helper to find enabled connection by driver type (case-insensitive)
  const getEnabledConnectionByDriver = useCallback((driver: string): DataSourceState | undefined => {
    const driverLower = driver.toLowerCase();
    return dataSources.find(
      (ds) => ds.enabled && ds.driver?.toLowerCase() === driverLower
    );
  }, [dataSources]);

  // Convenience getters for common drivers
  const snowflakeConnection = getEnabledConnectionByDriver("Snowflake");
  const zendeskConnection = getEnabledConnectionByDriver("Zendesk");
  const salesforceConnection = getEnabledConnectionByDriver("Salesforce");

  // Auto-fetch connections when token becomes available
  useEffect(() => {
    if (token && isConfigured && !isAuthLoading && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      listConnections()
        .then((connections) => {
          syncFromConnections(connections);
        })
        .catch((err) => {
          console.error("Failed to load connections:", err);
          setIsLoading(false);
        });
    }
  }, [token, isConfigured, isAuthLoading, listConnections, syncFromConnections]);

  return (
    <DataSourcesContext.Provider
      value={{
        dataSources,
        isLoading,
        setDataSourceEnabled,
        addDataSource,
        removeDataSource,
        syncFromConnections,
        getEnabledConnectionByDriver,
        snowflakeConnection,
        zendeskConnection,
        salesforceConnection,
      }}
    >
      {children}
    </DataSourcesContext.Provider>
  );
}

export function useDataSources() {
  const context = useContext(DataSourcesContext);
  if (!context) {
    throw new Error("useDataSources must be used within a DataSourcesProvider");
  }
  return context;
}
