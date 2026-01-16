import { createContext, useContext, useState, ReactNode } from "react";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "backlog" | "in-progress" | "review" | "done";
  assignee?: string;
  dueDate?: string;
  tags: string[];
}

interface TicketsContextValue {
  tickets: Ticket[];
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
  getTicketsByStatus: (status: Ticket["status"]) => Ticket[];
}

const TicketsContext = createContext<TicketsContextValue | null>(null);

const initialTickets: Ticket[] = [
  {
    id: "1",
    title: "Implement data export feature",
    description: "Allow users to export dashboard data to CSV/Excel",
    priority: "medium",
    status: "backlog",
    assignee: "Sarah K.",
    tags: ["feature"],
  },
  {
    id: "2",
    title: "Add dark mode support",
    description: "Implement theme switching functionality",
    priority: "low",
    status: "backlog",
    tags: ["enhancement"],
  },
  {
    id: "3",
    title: "Fix chart rendering bug",
    description: "Charts not displaying correctly on mobile",
    priority: "high",
    status: "in-progress",
    assignee: "Mike R.",
    dueDate: "Dec 30",
    tags: ["bug"],
  },
  {
    id: "4",
    title: "Optimize API queries",
    description: "Reduce response time for dashboard loading",
    priority: "high",
    status: "in-progress",
    assignee: "Alex T.",
    tags: ["performance"],
  },
  {
    id: "5",
    title: "New onboarding flow",
    description: "Simplified user onboarding experience",
    priority: "medium",
    status: "review",
    assignee: "Emma L.",
    tags: ["feature", "ux"],
  },
  {
    id: "6",
    title: "User authentication",
    description: "Implement SSO and 2FA support",
    priority: "high",
    status: "done",
    assignee: "Chris M.",
    tags: ["security"],
  },
];

export function TicketsProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);

  const getTicketsByStatus = (status: Ticket["status"]) => {
    return tickets.filter((t) => t.status === status);
  };

  return (
    <TicketsContext.Provider value={{ tickets, setTickets, getTicketsByStatus }}>
      {children}
    </TicketsContext.Provider>
  );
}

export function useTickets() {
  const context = useContext(TicketsContext);
  if (!context) {
    throw new Error("useTickets must be used within a TicketsProvider");
  }
  return context;
}
