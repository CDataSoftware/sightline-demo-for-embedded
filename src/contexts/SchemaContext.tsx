import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useCData } from "@/contexts/CDataContext";
import { useDataSources } from "@/contexts/DataSourcesContext";
import { useAuth } from "@/contexts/AuthContext";

export interface SchemaItem {
  type: "connection" | "schema" | "table" | "column";
  name: string;
  dataType?: string;
  children?: SchemaItem[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface SchemaContextValue {
  schemaTree: SchemaItem[];
  isLoadingSchema: boolean;
  refreshSchema: () => Promise<void>;
  loadChildren: (item: SchemaItem, path: string[]) => Promise<void>;
  toggleItem: (item: SchemaItem, path: string[]) => void;
  setSchemaTree: React.Dispatch<React.SetStateAction<SchemaItem[]>>;
}

const SchemaContext = createContext<SchemaContextValue | null>(null);

// Role-based schema filtering for non-admin users
// Schema -> Table -> Columns
const USER_ALLOWED_SCHEMA: Record<string, Record<string, string[]>> = {
  Salesforce: {
    Account: ["Id", "Name", "Industry", "AnnualRevenue", "Rating", "CustomerPriority__c", "Active__c"],
    Opportunity: ["Id", "Name", "Amount", "CloseDate", "StageName", "Probability", "AccountId", "IsClosed"],
  },
  Zendesk: {
    Tickets: ["Id", "Priority", "Status", "AccountId"],
  },
  TELEMETRY: {
    SYNC_USAGE: ["LASTTELEMETRYEVENT", "S_STANDARDJOBRUNS", "REVENUEBUCKETLAST12M", "ACCOUNT_ID"],
  },
};

export function SchemaProvider({ children }: { children: ReactNode }) {
  const { queryData, isConfigured, isLoading: isAuthLoading, token } = useCData();
  const { dataSources } = useDataSources();
  const { isAuthenticated, user } = useAuth();
  const [schemaTree, setSchemaTree] = useState<SchemaItem[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [hasFetchedSchema, setHasFetchedSchema] = useState(false);

  const isAdmin = user?.role === "admin";

  // Get enabled connection names for filtering
  const enabledConnectionNames = new Set(
    dataSources
      .filter((ds) => ds.enabled)
      .map((ds) => ds.name)
  );

  // Helper functions for role-based filtering
  const isSchemaAllowed = useCallback((schemaName: string) => {
    return isAdmin || schemaName in USER_ALLOWED_SCHEMA;
  }, [isAdmin]);

  const isTableAllowed = useCallback((schemaName: string, tableName: string) => {
    return isAdmin || (USER_ALLOWED_SCHEMA[schemaName]?.[tableName] !== undefined);
  }, [isAdmin]);

  const isColumnAllowed = useCallback((schemaName: string, tableName: string, columnName: string) => {
    return isAdmin || (USER_ALLOWED_SCHEMA[schemaName]?.[tableName]?.includes(columnName) ?? false);
  }, [isAdmin]);

  // Load schema tree dynamically from CData Embedded Cloud
  const loadSchemaTree = useCallback(async () => {
    if (!token || !isConfigured) return;

    setIsLoadingSchema(true);
    try {
      // If no connections are enabled, show empty tree
      if (enabledConnectionNames.size === 0) {
        setSchemaTree([]);
        setIsLoadingSchema(false);
        return;
      }

      // Get list of catalogs/connections from sys_catalogs
      const catalogsResult = await queryData(
        "SELECT DISTINCT [CatalogName] FROM [sys_catalogs]"
      );

      if (catalogsResult.results?.[0]) {
        const catalogs = catalogsResult.results[0].rows
          .map((row) => ({
            type: "connection" as const,
            name: row[0] as string,
            children: [],
            isExpanded: false,
          }))
          .filter((catalog) => enabledConnectionNames.has(catalog.name));
        setSchemaTree(catalogs);
      }
    } catch (err) {
      console.error("Failed to load schema from sys_catalogs:", err);
      // Fallback: list tables directly from sys_tables
      try {
        const tablesResult = await queryData(
          "SELECT [CatalogName], [SchemaName], [TableName] FROM [sys_tables] ORDER BY [CatalogName], [SchemaName], [TableName]"
        );

        if (tablesResult.results?.[0]) {
          const catalogMap = new Map<string, SchemaItem>();

          for (const row of tablesResult.results[0].rows) {
            const catalogName = row[0] as string;
            const schemaName = row[1] as string;
            const tableName = row[2] as string;

            // Skip catalogs for disabled connections
            if (!enabledConnectionNames.has(catalogName)) {
              continue;
            }

            if (!catalogMap.has(catalogName)) {
              catalogMap.set(catalogName, {
                type: "connection",
                name: catalogName,
                children: [],
                isExpanded: false,
              });
            }

            const catalog = catalogMap.get(catalogName)!;
            let schema = catalog.children?.find(
              (s) => s.name === schemaName
            );

            if (!schema) {
              schema = {
                type: "schema",
                name: schemaName,
                children: [],
                isExpanded: false,
              };
              catalog.children?.push(schema);
            }

            schema.children?.push({
              type: "table",
              name: tableName,
              children: [],
              isExpanded: false,
            });
          }

          setSchemaTree(Array.from(catalogMap.values()));
        }
      } catch (innerErr) {
        console.error("Failed to load tables from sys_tables:", innerErr);
      }
    } finally {
      setIsLoadingSchema(false);
    }
  }, [token, isConfigured, queryData, enabledConnectionNames]);

  // Load children for a tree item dynamically from Embedded Cloud
  const loadChildren = useCallback(
    async (item: SchemaItem, path: string[]) => {
      if (!token) return;

      const updateTree = (
        items: SchemaItem[],
        pathIndex: number,
        updater: (item: SchemaItem) => SchemaItem
      ): SchemaItem[] => {
        return items.map((i) => {
          if (i.name === path[pathIndex]) {
            if (pathIndex === path.length - 1) {
              return updater(i);
            }
            return {
              ...i,
              children: updateTree(i.children || [], pathIndex + 1, updater),
            };
          }
          return i;
        });
      };

      // Set loading state
      setSchemaTree((prev) =>
        updateTree(prev, 0, (i) => ({ ...i, isLoading: true }))
      );

      try {
        if (item.type === "connection") {
          // Load schemas for connection from sys_tables
          const result = await queryData(
            `SELECT DISTINCT [SchemaName] FROM [sys_tables] WHERE [CatalogName] = '${item.name}'`
          );

          if (result.results?.[0]) {
            const schemas: SchemaItem[] = result.results[0].rows
              .map((row) => ({
                type: "schema" as const,
                name: row[0] as string,
                children: [],
                isExpanded: false,
              }))
              .filter((schema) => isSchemaAllowed(schema.name));

            setSchemaTree((prev) =>
              updateTree(prev, 0, (i) => ({
                ...i,
                children: schemas,
                isLoading: false,
                isExpanded: true,
              }))
            );
          }
        } else if (item.type === "schema") {
          // Load tables for schema from sys_tables
          const catalogName = path[0];
          const result = await queryData(
            `SELECT [TableName] FROM [sys_tables] WHERE [CatalogName] = '${catalogName}' AND [SchemaName] = '${item.name}'`
          );

          if (result.results?.[0]) {
            const tables: SchemaItem[] = result.results[0].rows
              .map((row) => ({
                type: "table" as const,
                name: row[0] as string,
                children: [],
                isExpanded: false,
              }))
              .filter((table) => isTableAllowed(item.name, table.name));

            setSchemaTree((prev) =>
              updateTree(prev, 0, (i) => ({
                ...i,
                children: tables,
                isLoading: false,
                isExpanded: true,
              }))
            );
          }
        } else if (item.type === "table") {
          // Load columns for table from sys_tablecolumns
          const catalogName = path[0];
          const schemaName = path[1];
          const result = await queryData(
            `SELECT [ColumnName], [DataTypeName] FROM [sys_tablecolumns] WHERE [CatalogName] = '${catalogName}' AND [SchemaName] = '${schemaName}' AND [TableName] = '${item.name}'`
          );

          if (result.results?.[0]) {
            const columns: SchemaItem[] = result.results[0].rows
              .map((row) => ({
                type: "column" as const,
                name: row[0] as string,
                dataType: row[1] as string,
              }))
              .filter((col) => isColumnAllowed(schemaName, item.name, col.name));

            setSchemaTree((prev) =>
              updateTree(prev, 0, (i) => ({
                ...i,
                children: columns,
                isLoading: false,
                isExpanded: true,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load children:", err);
        setSchemaTree((prev) =>
          updateTree(prev, 0, (i) => ({ ...i, isLoading: false }))
        );
      }
    },
    [token, queryData, isSchemaAllowed, isTableAllowed, isColumnAllowed]
  );

  // Toggle tree item expansion
  const toggleItem = useCallback((item: SchemaItem, path: string[]) => {
    if (item.isExpanded) {
      // Collapse
      const updateTree = (
        items: SchemaItem[],
        pathIndex: number
      ): SchemaItem[] => {
        return items.map((i) => {
          if (i.name === path[pathIndex]) {
            if (pathIndex === path.length - 1) {
              return { ...i, isExpanded: false };
            }
            return {
              ...i,
              children: updateTree(i.children || [], pathIndex + 1),
            };
          }
          return i;
        });
      };
      setSchemaTree((prev) => updateTree(prev, 0));
    } else {
      // Expand - load children if needed
      if (!item.children || item.children.length === 0) {
        loadChildren(item, path);
      } else {
        const updateTree = (
          items: SchemaItem[],
          pathIndex: number
        ): SchemaItem[] => {
          return items.map((i) => {
            if (i.name === path[pathIndex]) {
              if (pathIndex === path.length - 1) {
                return { ...i, isExpanded: true };
              }
              return {
                ...i,
                children: updateTree(i.children || [], pathIndex + 1),
              };
            }
            return i;
          });
        };
        setSchemaTree((prev) => updateTree(prev, 0));
      }
    }
  }, [loadChildren]);

  // Load schema only after user is authenticated (to respect user-based permissions)
  useEffect(() => {
    if (isAuthenticated && token && isConfigured && !isAuthLoading && !hasFetchedSchema && enabledConnectionNames.size > 0) {
      setHasFetchedSchema(true);
      loadSchemaTree();
    }
  }, [isAuthenticated, token, isConfigured, isAuthLoading, hasFetchedSchema, loadSchemaTree, enabledConnectionNames.size]);

  // Reload schema when data sources change (after initial load)
  useEffect(() => {
    if (hasFetchedSchema && token && isConfigured) {
      loadSchemaTree();
    }
  }, [dataSources]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset schema when user changes (to apply role-based filtering)
  useEffect(() => {
    if (hasFetchedSchema) {
      setSchemaTree([]);
      setHasFetchedSchema(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SchemaContext.Provider
      value={{
        schemaTree,
        isLoadingSchema,
        refreshSchema: loadSchemaTree,
        loadChildren,
        toggleItem,
        setSchemaTree,
      }}
    >
      {children}
    </SchemaContext.Provider>
  );
}

export function useSchema() {
  const context = useContext(SchemaContext);
  if (!context) {
    throw new Error("useSchema must be used within a SchemaProvider");
  }
  return context;
}
