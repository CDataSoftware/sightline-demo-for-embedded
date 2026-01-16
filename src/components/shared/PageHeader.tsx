import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
