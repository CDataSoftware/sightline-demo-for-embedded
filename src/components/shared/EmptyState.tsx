import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-6 text-center", className)}>
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4 animate-scale-in">
        {icon}
      </div>
      <h3 className="font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed mb-4">
        {description}
      </p>
      {action}
    </div>
  );
}
