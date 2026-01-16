import { useState, useEffect, useRef, useCallback } from "react";
import { Database, Loader2, ExternalLink, CheckCircle2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDataSources } from "@/contexts/DataSourcesContext";
import { useCData } from "@/contexts/CDataContext";
import { Connection } from "@/lib/cdata";

export function DataSourcesPopover() {
  const { dataSources, setDataSourceEnabled, syncFromConnections, isLoading: isDataSourcesLoading } = useDataSources();
  const { listConnections, getGenericConnectionURL, getDataSourceLogoURL, token, isConfigured } = useCData();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [connectionURL, setConnectionURL] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [newConnection, setNewConnection] = useState<Connection | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const initialConnectionsRef = useRef<Set<string>>(new Set());

  // Refresh connections (re-sync from CData)
  const refreshConnections = useCallback(async () => {
    if (!token || !isConfigured) return;
    try {
      const connections = await listConnections();
      syncFromConnections(connections);
    } catch (err) {
      console.error("Failed to refresh connections:", err);
    }
  }, [token, isConfigured, listConnections, syncFromConnections]);

  // Manual refresh button handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshConnections();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Poll for connection creation while dialog is open
  useEffect(() => {
    if (!connectionDialogOpen || !token) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const checkConnection = async () => {
      try {
        const connections = await listConnections();
        // Check for any new connection
        const newConn = connections.find(
          (conn) => !initialConnectionsRef.current.has(conn.id)
        );
        if (newConn) {
          setConnectionVerified(true);
          setNewConnection(newConn);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        // Ignore polling errors
      }
    };

    // Poll every 2 seconds
    pollingRef.current = setInterval(checkConnection, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [connectionDialogOpen, token, listConnections]);

  const enabledCount = dataSources.filter((s) => s.enabled).length;

  const handleAddDataSource = async () => {
    if (!token) {
      setConnectionError("Not authenticated. Please refresh the page.");
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Store current connections to detect new ones
      const connections = await listConnections();
      initialConnectionsRef.current = new Set(connections.map((c) => c.id));

      // Get generic connection picker URL
      const url = await getGenericConnectionURL();
      console.log("Generic connection URL received:", url);
      if (!url) {
        throw new Error("No connection URL received from API");
      }
      setConnectionURL(url);
      setConnectionVerified(false);
      setNewConnection(null);
      setConnectionDialogOpen(true);
    } catch (err) {
      console.error("Connection error:", err);
      setConnectionError(err instanceof Error ? err.message : "Failed to start connection");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectionComplete = async () => {
    setConnectionDialogOpen(false);
    setConnectionURL(null);
    setNewConnection(null);

    // Refresh connections list to pick up the new connection
    await refreshConnections();
  };

  const handleDialogClose = () => {
    setConnectionDialogOpen(false);
    setConnectionURL(null);
    // Check if connection was made
    if (connectionVerified) {
      handleConnectionComplete();
    }
  };

  const toggleDataSource = (id: string, checked: boolean) => {
    setDataSourceEnabled(id, checked);
  };

  const isLoading = isDataSourcesLoading;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Database className="h-4 w-4" />
            Data Sources
            <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {enabledCount}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 bg-popover p-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="font-semibold text-sm">Data Sources</h4>
                <p className="text-xs text-muted-foreground">
                  Toggle connected sources
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={isRefreshing || !token}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="p-3 space-y-1 max-h-[280px] overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : dataSources.length === 0 ? (
              <div className="py-6 px-2 text-center">
                <Database className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No data sources connected</p>
              </div>
            ) : (
              dataSources.map((source, index) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <Label
                    htmlFor={source.id}
                    className="text-sm font-normal cursor-pointer flex items-center gap-2.5 flex-1"
                  >
                    {source.logoUrl && (
                      <img
                        src={source.logoUrl}
                        alt=""
                        className="h-5 w-5 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <span>{source.name}</span>
                  </Label>
                  <Switch
                    id={source.id}
                    checked={source.enabled}
                    onCheckedChange={(checked) => toggleDataSource(source.id, checked)}
                  />
                </div>
              ))
            )}
          </div>

          {/* Add Data Source Button */}
          <div className="p-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
              onClick={handleAddDataSource}
              disabled={isConnecting || !token}
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Data Source
            </Button>
          </div>

          {connectionError && (
            <div className="px-3 pb-3">
              <p className="text-xs text-destructive">{connectionError}</p>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={connectionDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newConnection && (
                <img
                  src={getDataSourceLogoURL(newConnection.driver)}
                  alt=""
                  className="h-5 w-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              Add Data Source
              {connectionURL && (
                <a
                  href={connectionURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </DialogTitle>
            <DialogDescription>
              Select a data source and configure your connection.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {connectionURL ? (
              <iframe
                src={connectionURL}
                className="w-full h-full border-0 rounded-md"
                title="Connection Configuration"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleDialogClose}>
              Cancel
            </Button>
            {connectionVerified ? (
              <Button onClick={handleConnectionComplete} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Done
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center">
                Complete the connection setup above, then click Done
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
