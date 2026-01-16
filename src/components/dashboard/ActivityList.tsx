import { CheckCircle2, AlertCircle, MessageSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const activities = [
  {
    id: 1,
    type: "success",
    title: "Report generated",
    description: "Monthly sales report completed",
    time: "2 min ago",
    icon: CheckCircle2,
  },
  {
    id: 2,
    type: "warning",
    title: "Anomaly detected",
    description: "Unusual spike in API requests",
    time: "15 min ago",
    icon: AlertCircle,
  },
  {
    id: 3,
    type: "info",
    title: "New insight",
    description: "Customer retention up by 12%",
    time: "1 hour ago",
    icon: TrendingUp,
  },
  {
    id: 4,
    type: "default",
    title: "Query answered",
    description: '"What was Q3 revenue?" processed',
    time: "2 hours ago",
    icon: MessageSquare,
  },
];

export function ActivityList() {
  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className={cn(
            "p-2 rounded-lg shrink-0",
            activity.type === "success" && "bg-success/10 text-success",
            activity.type === "warning" && "bg-warning/10 text-warning",
            activity.type === "info" && "bg-primary/10 text-primary",
            activity.type === "default" && "bg-muted text-muted-foreground"
          )}>
            <activity.icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{activity.title}</p>
            <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{activity.time}</span>
        </div>
      ))}
    </div>
  );
}