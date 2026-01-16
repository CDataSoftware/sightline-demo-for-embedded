import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { CDataProvider } from "@/contexts/CDataContext";
import { DataSourcesProvider } from "@/contexts/DataSourcesContext";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";
import { SchemaProvider } from "@/contexts/SchemaContext";
import { SavedPromptsProvider } from "@/contexts/SavedPromptsContext";
import { SavedQueriesProvider } from "@/contexts/SavedQueriesContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TicketsProvider } from "@/contexts/TicketsContext";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Tickets from "./pages/Tickets";
import DataExplorer from "./pages/DataExplorer";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route wrapper that requires authentication
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Admin-only route wrapper
function RequireAdmin({ children, fallback }: { children: React.ReactNode; fallback: string }) {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Login />} />
    <Route path="/*" element={
      <RequireAuth>
        <AppLayout>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chat" element={
              <RequireAdmin fallback="/dashboard">
                <Chat />
              </RequireAdmin>
            } />
            <Route path="/explorer" element={<DataExplorer />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </RequireAuth>
    } />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CDataProvider>
        <DataSourcesProvider>
          <DashboardDataProvider>
            <SchemaProvider>
              <SavedPromptsProvider>
                <SavedQueriesProvider>
                  <TicketsProvider>
                    <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      <AppRoutes />
                    </TooltipProvider>
                  </TicketsProvider>
                </SavedQueriesProvider>
              </SavedPromptsProvider>
            </SchemaProvider>
          </DashboardDataProvider>
        </DataSourcesProvider>
      </CDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
