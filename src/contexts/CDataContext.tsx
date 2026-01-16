import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import {
  generateJWT,
  getMCPBaseURL,
  hasCredentials,
  listMCPTools,
  callMCPTool,
  queryData as cdataQueryData,
  queryResultToObjects,
  listConnections as cdataListConnections,
  deleteConnection as cdataDeleteConnection,
  getConnectionCreateURL as cdataGetConnectionCreateURL,
  getGenericConnectionURL as cdataGetGenericConnectionURL,
  getDataSourceLogoURL,
  MCPTool,
  APIQueryResponse,
  Connection,
} from "@/lib/cdata";

interface CDataContextValue {
  isConfigured: boolean;
  isLoading: boolean;
  token: string | null;
  mcpBaseURL: string;
  tools: MCPTool[];
  error: string | null;
  refreshToken: () => Promise<void>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  queryData: (sql: string) => Promise<APIQueryResponse>;
  queryDataAsObjects: <T>(sql: string) => Promise<T[]>;
  listConnections: () => Promise<Connection[]>;
  deleteConnection: (connectionId: string) => Promise<void>;
  getConnectionCreateURL: (driver: string, connectionName: string) => Promise<string>;
  getGenericConnectionURL: () => Promise<string>;
  getDataSourceLogoURL: (driver: string) => string;
}

const CDataContext = createContext<CDataContextValue | null>(null);

export function CDataProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs to track token and expiry for use in callbacks without stale closures
  const tokenRef = useRef<string | null>(null);
  const tokenExpiryRef = useRef<number>(0);
  const isRefreshingRef = useRef(false);

  const isConfigured = hasCredentials();

  // Internal refresh that returns the new token
  const doRefreshToken = useCallback(async (): Promise<string> => {
    if (!isConfigured) {
      throw new Error("CData credentials not configured");
    }

    // Prevent concurrent refreshes
    if (isRefreshingRef.current) {
      // Wait for existing refresh to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      if (tokenRef.current) {
        return tokenRef.current;
      }
    }

    isRefreshingRef.current = true;
    try {
      const newToken = await generateJWT();

      // Update both state and ref
      setToken(newToken);
      tokenRef.current = newToken;

      // Track token expiry (JWT is valid for 2 hours, refresh 5 min before)
      tokenExpiryRef.current = Date.now() + (2 * 60 * 60 * 1000) - (5 * 60 * 1000);

      // Load available MCP tools
      const availableTools = await listMCPTools(newToken);
      setTools(availableTools);

      setError(null);
      return newToken;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize");
      setToken(null);
      tokenRef.current = null;
      setTools([]);
      throw err;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [isConfigured]);

  const refreshToken = useCallback(async () => {
    setIsLoading(true);
    try {
      await doRefreshToken();
    } finally {
      setIsLoading(false);
    }
  }, [doRefreshToken]);

  // Check if token needs refresh (expired or about to expire)
  const isTokenExpired = useCallback(() => {
    return !tokenRef.current || Date.now() >= tokenExpiryRef.current;
  }, []);

  // Get a valid token, refreshing if necessary
  const getValidToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current && !isTokenExpired()) {
      return tokenRef.current;
    }
    return doRefreshToken();
  }, [isTokenExpired, doRefreshToken]);

  // Wrapper to auto-retry API calls on auth failure
  const withAutoRefresh = useCallback(async <T,>(
    apiCall: (token: string) => Promise<T>
  ): Promise<T> => {
    const currentToken = await getValidToken();
    try {
      return await apiCall(currentToken);
    } catch (err) {
      // Check if it's an auth error (401 or auth-related message)
      const isAuthError = err instanceof Error && (
        err.message.includes("401") ||
        err.message.toLowerCase().includes("unauthorized") ||
        err.message.toLowerCase().includes("authentication") ||
        err.message.toLowerCase().includes("token")
      );

      if (isAuthError) {
        // Force refresh and retry once
        console.log("Auth error detected, refreshing token and retrying...");
        const newToken = await doRefreshToken();
        return await apiCall(newToken);
      }
      throw err;
    }
  }, [getValidToken, doRefreshToken]);

  const callTool = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      return withAutoRefresh((t) => callMCPTool(t, name, args));
    },
    [withAutoRefresh]
  );

  const queryData = useCallback(
    async (sql: string): Promise<APIQueryResponse> => {
      return withAutoRefresh((t) => cdataQueryData(t, sql));
    },
    [withAutoRefresh]
  );

  const queryDataAsObjects = useCallback(
    async <T,>(sql: string): Promise<T[]> => {
      const response = await queryData(sql);
      if (response.results?.[0]) {
        return queryResultToObjects<T>(response.results[0]);
      }
      return [];
    },
    [queryData]
  );

  const listConnections = useCallback(async (): Promise<Connection[]> => {
    return withAutoRefresh((t) => cdataListConnections(t));
  }, [withAutoRefresh]);

  const deleteConnection = useCallback(
    async (connectionId: string): Promise<void> => {
      return withAutoRefresh((t) => cdataDeleteConnection(t, connectionId));
    },
    [withAutoRefresh]
  );

  const getConnectionCreateURL = useCallback(
    async (driver: string, connectionName: string): Promise<string> => {
      return withAutoRefresh((t) => cdataGetConnectionCreateURL(t, driver, connectionName));
    },
    [withAutoRefresh]
  );

  const getGenericConnectionURL = useCallback(async (): Promise<string> => {
    return withAutoRefresh((t) => cdataGetGenericConnectionURL(t));
  }, [withAutoRefresh]);

  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  return (
    <CDataContext.Provider
      value={{
        isConfigured,
        isLoading,
        token,
        mcpBaseURL: getMCPBaseURL(),
        tools,
        error,
        refreshToken,
        callTool,
        queryData,
        queryDataAsObjects,
        listConnections,
        deleteConnection,
        getConnectionCreateURL,
        getGenericConnectionURL,
        getDataSourceLogoURL,
      }}
    >
      {children}
    </CDataContext.Provider>
  );
}

export function useCData() {
  const context = useContext(CDataContext);
  if (!context) {
    throw new Error("useCData must be used within a CDataProvider");
  }
  return context;
}
