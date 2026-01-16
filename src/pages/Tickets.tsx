import { Plus, MoreHorizontal, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTickets, Ticket } from "@/contexts/TicketsContext";

interface Column {
  id: Ticket["status"];
  title: string;
}

const columns: Column[] = [
  { id: "backlog", title: "Backlog" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "In Review" },
  { id: "done", title: "Done" },
];

const priorityConfig = {
  low: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-muted-foreground/20"
  },
  medium: {
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/30"
  },
  high: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30"
  },
};

const tagColors: Record<string, string> = {
  feature: "bg-primary/10 text-primary border-primary/20",
  bug: "bg-destructive/10 text-destructive border-destructive/20",
  enhancement: "bg-accent/20 text-accent-foreground border-accent/30",
  performance: "bg-warning/10 text-warning border-warning/20",
  security: "bg-success/10 text-success border-success/20",
  ux: "bg-primary/10 text-primary border-primary/20",
};

function TicketCard({ ticket, index }: { ticket: Ticket; index: number }) {
  const priority = priorityConfig[ticket.priority];

  return (
    <div
      className="p-4 bg-card border border-border rounded-xl hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-2">
        <span className={cn(
          "text-xs font-semibold px-2.5 py-1 rounded-full border",
          priority.bg,
          priority.text,
          priority.border
        )}>
          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
        </span>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded-lg">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <h4 className="font-medium text-sm mb-1.5 group-hover:text-primary transition-colors">{ticket.title}</h4>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{ticket.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {ticket.tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "text-xs px-2 py-0.5 rounded-full border",
              tagColors[tag] || "bg-muted text-muted-foreground border-border"
            )}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
        {ticket.assignee && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-3 w-3 text-primary" />
            </div>
            <span>{ticket.assignee}</span>
          </div>
        )}
        {ticket.dueDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{ticket.dueDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Tickets() {
  const { getTicketsByStatus } = useTickets();

  return (
    <div className="h-screen flex flex-col animate-fade-in">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
            <p className="text-muted-foreground mt-1">Track and manage your team's work</p>
          </div>
          <Button className="gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-6 h-full min-w-max">
          {columns.map((column, colIndex) => {
            const columnTickets = getTicketsByStatus(column.id);
            return (
              <div
                key={column.id}
                className="w-72 flex flex-col animate-fade-in"
                style={{ animationDelay: `${colIndex * 100}ms` }}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{column.title}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {columnTickets.length}
                    </span>
                  </div>
                  <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Tickets */}
                <div className="flex-1 space-y-3 pb-4">
                  {columnTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-border rounded-xl text-center">
                      <p className="text-sm text-muted-foreground">No tickets</p>
                    </div>
                  ) : (
                    columnTickets.map((ticket, ticketIndex) => (
                      <TicketCard key={ticket.id} ticket={ticket} index={ticketIndex} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
