import { useState, useEffect, useRef, useCallback } from "react";
import {
  Database,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCData } from "@/contexts/CDataContext";
import { useDataSources } from "@/contexts/DataSourcesContext";
import { Connection } from "@/lib/cdata";

export default function Settings() {
  const {
    token,
    isConfigured,
    isLoading: isCDataLoading,
    error: cDataError,
    listConnections,
    deleteConnection,
    getGenericConnectionURL,
    getDataSourceLogoURL,
  } = useCData();
  const { syncFromConnections } = useDataSources();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add connection dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [connectionURL, setConnectionURL] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [newConnection, setNewConnection] = useState<Connection | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const initialConnectionsRef = useRef<Set<string>>(new Set());

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load connections
  const loadConnections = useCallback(async () => {
    if (!token || !isConfigured) return;

    setIsLoadingConnections(true);
    setError(null);

    try {
      const conns = await listConnections();
      setConnections(conns);
      syncFromConnections(conns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load connections");
    } finally {
      setIsLoadingConnections(false);
    }
  }, [token, isConfigured, listConnections, syncFromConnections]);

  // Initial load
  useEffect(() => {
    if (token && isConfigured) {
      loadConnections();
    }
  }, [token, isConfigured, loadConnections]);

  // Refresh connections
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadConnections();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Add connection
  const handleAddConnection = async () => {
    if (!token) {
      setError("Not authenticated. Please refresh the page.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Store current connections to detect new ones
      initialConnectionsRef.current = new Set(connections.map((c) => c.id));

      // Get generic connection picker URL
      const url = await getGenericConnectionURL();
      if (!url) {
        throw new Error("No connection URL received from API");
      }
      setConnectionURL(url);
      setConnectionVerified(false);
      setNewConnection(null);
      setIsAddDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start connection");
    } finally {
      setIsConnecting(false);
    }
  };

  // Poll for connection creation while dialog is open
  useEffect(() => {
    if (!isAddDialogOpen || !token) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const checkConnection = async () => {
      try {
        const conns = await listConnections();
        // Check for any new connection
        const newConn = conns.find(
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
      } catch {
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
  }, [isAddDialogOpen, token, listConnections]);

  // Complete connection
  const handleConnectionComplete = async () => {
    setIsAddDialogOpen(false);
    setConnectionURL(null);
    setNewConnection(null);
    await loadConnections();
  };

  // Close add dialog
  const handleAddDialogClose = () => {
    setIsAddDialogOpen(false);
    setConnectionURL(null);
    if (connectionVerified) {
      handleConnectionComplete();
    }
  };

  // Delete connection
  const handleDeleteClick = (connection: Connection) => {
    setConnectionToDelete(connection);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!connectionToDelete) return;

    setIsDeleting(true);
    try {
      await deleteConnection(connectionToDelete.id);
      await loadConnections();
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete connection");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setConnectionToDelete(null);
  };

  // Loading state
  if (isCDataLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not configured state
  if (!isConfigured) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              CData Not Configured
            </CardTitle>
            <CardDescription>
              CData Embedded Cloud credentials are not configured. Please add the following
              environment variables to enable connection management:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>VITE_CDATA_ACCOUNT_ID</li>
              <li>VITE_CDATA_SUBSCRIBER_ID</li>
              <li>VITE_CDATA_PRIVATE_KEY</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your data source connections and application settings.
          </p>
        </div>
      </div>

      {/* Connection Management */}
      <Card className="transition-all duration-200 hover:shadow-md hover:border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Data Source Connections</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoadingConnections}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button size="sm" onClick={handleAddConnection} disabled={isConnecting}>
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Connection
              </Button>
            </div>
          </div>
          <CardDescription>
            Manage connections to external data sources. These connections are available
            in the Data Sources popover and Data Explorer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(error || cDataError) && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              {error || cDataError}
            </div>
          )}

          {isLoadingConnections ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Database className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <h3 className="font-medium text-foreground mb-1">No connections configured</h3>
              <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
                Click "Add Connection" to connect your first data source.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((conn, index) => (
                  <TableRow 
                    key={conn.id} 
                    className="hover:bg-muted/50 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <TableCell>
                      <img
                        src={getDataSourceLogoURL(conn.driver)}
                        alt=""
                        className="h-6 w-6 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{conn.name}</TableCell>
                    <TableCell className="text-muted-foreground">{conn.driver}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Connected
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteClick(conn)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Connection Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogClose}>
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
              Add Data Source Connection
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
            <Button variant="outline" onClick={handleAddDialogClose}>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the connection "{connectionToDelete?.name}"?
              This action cannot be undone and will remove access to this data source.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
