import { useState } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  HelpCircle,
  Eye,
  Database,
  LogOut,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useTickets } from "@/contexts/TicketsContext";

const allNavItems = [
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard, adminOnly: false },
  { title: "Data Advisor", path: "/chat", icon: MessageSquare, adminOnly: true },
  { title: "Data Explorer", path: "/explorer", icon: Database, adminOnly: false },
];

const bottomItems = [
  { title: "Settings", path: "/settings", icon: Settings },
  { title: "Help", path: "/help", icon: HelpCircle },
];

const priorityConfig = {
  low: {
    dot: "bg-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
  medium: {
    dot: "bg-warning",
    badge: "bg-warning/10 text-warning",
  },
  high: {
    dot: "bg-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
};

const statusLabels = {
  backlog: "Backlog",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
};

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [ticketsExpanded, setTicketsExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { tickets } = useTickets();

  // Filter nav items based on user role
  const navItems = allNavItems.filter(item => !item.adminOnly || user?.role === "admin");

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const NavItem = ({ item, isBottom = false }: { item: typeof navItems[0]; isBottom?: boolean }) => {
    const isActive = location.pathname === item.path;
    
    const linkContent = (
      <RouterNavLink
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
          "hover:bg-sidebar-accent group",
          isActive && "bg-primary/10 text-primary font-medium",
          !isActive && "text-muted-foreground hover:text-foreground"
        )}
      >
        <item.icon className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          isActive && "text-primary"
        )} />
        {!collapsed && (
          <span className="text-sm truncate">{item.title}</span>
        )}
      </RouterNavLink>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
            <Eye className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg tracking-tight">Sightline</span>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-hidden flex flex-col">
        {navItems.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}

        {/* Expandable Tickets Section */}
        <div>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <RouterNavLink
                  to="/tickets"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    "hover:bg-sidebar-accent group",
                    location.pathname === "/tickets" && "bg-primary/10 text-primary font-medium",
                    location.pathname !== "/tickets" && "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Ticket className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    location.pathname === "/tickets" && "text-primary"
                  )} />
                </RouterNavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                Tickets ({tickets.length})
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <button
                onClick={() => setTicketsExpanded(!ticketsExpanded)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  "hover:bg-sidebar-accent group",
                  location.pathname === "/tickets" && "bg-primary/10 text-primary font-medium",
                  location.pathname !== "/tickets" && "text-muted-foreground hover:text-foreground"
                )}
              >
                <Ticket className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  location.pathname === "/tickets" && "text-primary"
                )} />
                <span className="text-sm truncate flex-1 text-left">Tickets</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {tickets.length}
                </span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  ticketsExpanded && "rotate-180"
                )} />
              </button>

              {ticketsExpanded && (
                <div className="mt-2 space-y-2 overflow-y-auto max-h-[280px] ml-3 pr-1">
                  {/* Board View Link */}
                  <RouterNavLink
                    to="/tickets"
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                      "hover:bg-sidebar-accent",
                      location.pathname === "/tickets"
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Kanban className="h-4 w-4" />
                    <span>Board View</span>
                  </RouterNavLink>

                  {/* Ticket Cards */}
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => navigate(`/tickets?id=${ticket.id}`)}
                      className="w-full p-2.5 rounded-lg border border-border/50 bg-card/50 hover:bg-sidebar-accent hover:border-primary/20 transition-all text-left group"
                    >
                      <div className="flex items-start gap-2 mb-1.5">
                        <span className={cn(
                          "shrink-0 mt-1 h-2 w-2 rounded-full",
                          priorityConfig[ticket.priority].dot
                        )} />
                        <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                          {ticket.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-4">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium",
                          priorityConfig[ticket.priority].badge
                        )}>
                          {ticket.priority}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {statusLabels[ticket.status]}
                        </span>
                      </div>
                      {ticket.assignee && (
                        <div className="mt-1.5 ml-4 text-[10px] text-muted-foreground truncate">
                          {ticket.assignee}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="p-3 space-y-1 border-t border-sidebar-border">
        {bottomItems.map((item) => (
          <NavItem key={item.path} item={item} isBottom />
        ))}
        
        {/* Logout Button */}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-center px-0 py-2.5 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Sign out
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-3 px-3 py-2.5 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm">Sign out</span>
          </Button>
        )}

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full justify-start gap-3 px-3 py-2.5 text-muted-foreground hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}