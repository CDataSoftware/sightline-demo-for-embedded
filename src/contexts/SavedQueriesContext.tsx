import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  source: "advisor" | "explorer" | "manual";
  createdAt: Date;
  lastUsedAt?: Date;
}

interface SavedQueriesContextValue {
  queries: SavedQuery[];
  saveQuery: (sql: string, name?: string, source?: SavedQuery["source"]) => void;
  deleteQuery: (id: string) => void;
  updateQuery: (id: string, updates: Partial<Pick<SavedQuery, "name" | "sql">>) => void;
  isQuerySaved: (sql: string) => boolean;
  getQueryById: (id: string) => SavedQuery | undefined;
}

const STORAGE_KEY = "sightline-saved-queries";

const SavedQueriesContext = createContext<SavedQueriesContextValue | null>(null);

function loadFromStorage(): SavedQuery[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Convert date strings back to Date objects
    return parsed.map((q: SavedQuery) => ({
      ...q,
      createdAt: new Date(q.createdAt),
      lastUsedAt: q.lastUsedAt ? new Date(q.lastUsedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveToStorage(queries: SavedQuery[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
}

// Generate a name from SQL query
function generateQueryName(sql: string): string {
  const normalized = sql.trim().toUpperCase();

  // Try to extract table name from common patterns
  const fromMatch = sql.match(/FROM\s+\[?([^\]\s,]+)\]?/i);
  const tableName = fromMatch ? fromMatch[1].split(".").pop() : null;

  if (normalized.startsWith("SELECT")) {
    if (tableName) {
      if (normalized.includes("JOIN")) {
        return `Join query on ${tableName}`;
      }
      if (normalized.includes("GROUP BY")) {
        return `Aggregate on ${tableName}`;
      }
      return `Select from ${tableName}`;
    }
    return "Select query";
  }

  if (normalized.startsWith("INSERT")) {
    return tableName ? `Insert into ${tableName}` : "Insert query";
  }

  if (normalized.startsWith("UPDATE")) {
    return tableName ? `Update ${tableName}` : "Update query";
  }

  if (normalized.startsWith("DELETE")) {
    return tableName ? `Delete from ${tableName}` : "Delete query";
  }

  return "Query";
}

export function SavedQueriesProvider({ children }: { children: ReactNode }) {
  const [queries, setQueries] = useState<SavedQuery[]>(() => loadFromStorage());

  // Persist to localStorage whenever queries change
  useEffect(() => {
    saveToStorage(queries);
  }, [queries]);

  const saveQuery = useCallback((sql: string, name?: string, source: SavedQuery["source"] = "manual") => {
    const trimmed = sql.trim();
    if (!trimmed) return;

    // Don't save duplicates (check by normalized SQL)
    const normalizedSql = trimmed.toLowerCase().replace(/\s+/g, " ");
    const exists = queries.some(q =>
      q.sql.toLowerCase().replace(/\s+/g, " ") === normalizedSql
    );
    if (exists) return;

    const newQuery: SavedQuery = {
      id: `query-${Date.now()}`,
      name: name || generateQueryName(trimmed),
      sql: trimmed,
      source,
      createdAt: new Date(),
    };
    setQueries(prev => [newQuery, ...prev]);
  }, [queries]);

  const deleteQuery = useCallback((id: string) => {
    setQueries(prev => prev.filter(q => q.id !== id));
  }, []);

  const updateQuery = useCallback((id: string, updates: Partial<Pick<SavedQuery, "name" | "sql">>) => {
    setQueries(prev => prev.map(q =>
      q.id === id ? { ...q, ...updates } : q
    ));
  }, []);

  const isQuerySaved = useCallback((sql: string) => {
    const normalizedSql = sql.trim().toLowerCase().replace(/\s+/g, " ");
    return queries.some(q =>
      q.sql.toLowerCase().replace(/\s+/g, " ") === normalizedSql
    );
  }, [queries]);

  const getQueryById = useCallback((id: string) => {
    return queries.find(q => q.id === id);
  }, [queries]);

  return (
    <SavedQueriesContext.Provider
      value={{
        queries,
        saveQuery,
        deleteQuery,
        updateQuery,
        isQuerySaved,
        getQueryById,
      }}
    >
      {children}
    </SavedQueriesContext.Provider>
  );
}

export function useSavedQueries() {
  const context = useContext(SavedQueriesContext);
  if (!context) {
    throw new Error("useSavedQueries must be used within a SavedQueriesProvider");
  }
  return context;
}
